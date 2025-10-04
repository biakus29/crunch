import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";

// Composants réutilisables (supposés existants)
import LoyaltyPointsManager from "./LoyaltyPoints";
import CreateOrderForm from "./CreateOrderForm";

// Constantes pour les statuts des commandes
const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  READY_TO_DELIVER: "pret_a_livrer",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  FAILED: "echec",
};

const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "En attente",
  [ORDER_STATUS.PREPARING]: "En préparation",
  [ORDER_STATUS.READY_TO_DELIVER]: "Prêt à livrer",
  [ORDER_STATUS.DELIVERING]: "En livraison",
  [ORDER_STATUS.DELIVERED]: "Livrée",
  [ORDER_STATUS.FAILED]: "Échec",
};

const STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-yellow-500 text-white",
  [ORDER_STATUS.PREPARING]: "bg-blue-500 text-white",
  [ORDER_STATUS.READY_TO_DELIVER]: "bg-purple-500 text-white",
  [ORDER_STATUS.DELIVERING]: "bg-orange-500 text-white",
  [ORDER_STATUS.DELIVERED]: "bg-green-600 text-white",
  [ORDER_STATUS.FAILED]: "bg-red-600 text-white",
};

const STATUS_COLUMN_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-gray-100 border-gray-300",
  [ORDER_STATUS.PREPARING]: "bg-blue-50 border-blue-200",
  [ORDER_STATUS.READY_TO_DELIVER]: "bg-purple-50 border-purple-200",
  [ORDER_STATUS.DELIVERING]: "bg-yellow-50 border-yellow-200",
  [ORDER_STATUS.DELIVERED]: "bg-green-50 border-green-200",
};

const DEFAULT_DELIVERY_FEE = 1000;

const FAILURE_REASONS = [
  "Client injoignable",
  "Adresse incorrecte",
  "Annulation par le client",
  "Problème de stock",
  "Erreur de livraison",
  "Autre",
];

// Fonctions utilitaires
export const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const convertPrice = (price) => {
  if (typeof price === "string") {
    return parseFloat(price.replace(/\./g, ""));
  }
  return Number(price);
};

const calculateOrderTotals = (order, extraLists, items) => {
  const subtotal = order.items.reduce((sum, item) => {
    const currentItem = items.find((it) => it.id === item.dishId);
    const itemPrice = item.price !== undefined && !isNaN(convertPrice(item.price))
      ? convertPrice(item.price)
      : item.dishPrice !== undefined && !isNaN(convertPrice(item.dishPrice))
      ? convertPrice(item.dishPrice)
      : currentItem?.price
      ? convertPrice(currentItem.price)
      : 0;
    const extrasTotal = item.selectedExtras
      ? Object.entries(item.selectedExtras).reduce((extraSum, [extraListId, indexes]) => {
          const extraList = extraLists.find((el) => el.id === extraListId)?.extraListElements || [];
          return extraSum + indexes.reduce((acc, index) => acc + Number(extraList[index]?.price || 0), 0);
        }, 0)
      : 0;
    return sum + (itemPrice + extrasTotal) * Number(item.quantity || 1);
  }, 0);
  const deliveryFee = order.deliveryFee !== undefined ? Number(order.deliveryFee) : DEFAULT_DELIVERY_FEE;
  const pointsReduction = Number(order.pointsReduction) || 0;
  const totalWithDelivery = subtotal + deliveryFee - pointsReduction;
  return { subtotal, totalWithDelivery, pointsReduction };
};

// Composant pour afficher une carte de commande
const OrderCard = ({ order, items, extraLists, usersData, onShowDetails, onDragStart, onDragEnd }) => {
  const user = order.userId
    ? usersData.byId[order.userId]
    : order.contact?.phone && usersData.byPhone[order.contact.phone];
  const clientInfo = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Utilisateur inconnu"
    : order.contact?.name || "Client inconnu";
  const phoneNumber = user?.phone || order.address?.phone || order.contact?.phone || "Non spécifié";
  const address = order.address || {};
  const quartier = address.area || "Non spécifié";
  const description = address.completeAddress || "Non spécifié";
  const deliveryFee = order.deliveryFee !== undefined ? Number(order.deliveryFee) : DEFAULT_DELIVERY_FEE;
  const { subtotal, totalWithDelivery } = calculateOrderTotals(order, extraLists, items);

  const getExtraName = (extraListId, index) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    const element = extraList?.extraListElements?.[index];
    return element ? `${element.name}${element.price ? ` (+${formatPrice(element.price)} FCFA)` : ""}` : "Extra inconnu";
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onShowDetails(order)}
      className="mb-3 p-3 bg-white rounded-lg shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow w-full"
    >
      <div className="flex flex-col space-y-2 text-base">
        <div className="font-medium text-gray-800 truncate" title={clientInfo}>
          Client: {clientInfo}
          <span className="ml-2 text-gray-600 text-sm">Tel: {phoneNumber}</span>
        </div>
        <div className="text-gray-600">Quartier: {quartier}</div>
        <div className="text-gray-600">Adresse: {description}</div>
        <div className="text-gray-600">Frais de livraison: {formatPrice(deliveryFee)} FCFA</div>
        <div className="flex justify-between items-center">
          <div className="text-gray-600">ID: #{order.id.slice(0, 6)}</div>
          <span
            className={`inline-block px-2 py-1 rounded text-sm font-medium ${
              STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"
            }`}
          >
            Statut: {STATUS_LABELS[order.status] || "En attente"}
          </span>
        </div>
        <div className="border-t pt-2">
          <h4 className="font-semibold text-sm mb-1">Articles:</h4>
          <div className="max-h-32 overflow-y-auto text-sm">
            {order.items.map((item, index) => {
              const currentItem = items.find((it) => it.id === item.dishId);
              const price = item.price !== undefined && !isNaN(convertPrice(item.price))
                ? convertPrice(item.price)
                : item.dishPrice !== undefined && !isNaN(convertPrice(item.dishPrice))
                ? convertPrice(item.dishPrice)
                : currentItem?.price
                ? convertPrice(currentItem.price)
                : 0;
              return (
                <div key={`${item.dishId}-${index}`} className="mb-1">
                  <div className="flex justify-between">
                    <span>{currentItem?.name || item.dishName || "Plat inconnu"}</span>
                    <span>{formatPrice(price)} FCFA × {item.quantity}</span>
                  </div>
                  {item.selectedExtras && (
                    <div className="text-gray-600 text-xs ml-2">
                      {Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
                        <div key={extraListId}>
                          {indexes.map((index) => getExtraName(extraListId, index)).join(", ")}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="border-t pt-2 text-sm">
          <div className="flex justify-between">
            <span>Sous-total:</span>
            <span>{formatPrice(subtotal)} FCFA</span>
          </div>
          <div className="flex justify-between">
            <span>Frais:</span>
            <span>{formatPrice(deliveryFee)} FCFA</span>
          </div>
          <div className="flex justify-between">
            <span>Réduction points:</span>
            <span className="text-red-600">{formatPrice(Number(order.pointsReduction) || 0)} FCFA</span>
          </div>
          <div className="flex justify-between text-green-600 font-semibold">
            <span>Total:</span>
            <span>{formatPrice(totalWithDelivery)} FCFA</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className={`font-medium ${order.isPaid ? "text-green-600" : "text-red-600"}`}>
            Payé: {order.isPaid ? "Oui" : "Non"}
          </span>
          <label
            className="relative inline-flex items-center cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={order.isPaid || false}
              onChange={async (e) => {
                try {
                  const orderRef = doc(db, "orders", order.id);
                  await updateDoc(orderRef, {
                    isPaid: e.target.checked,
                    updatedAt: Timestamp.now(),
                  });
                } catch (error) {
                  console.error("Erreur lors de la mise à jour du statut payé:", error);
                  // Optionally, handle error at a higher level or show a toast/alert here
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Points utilisés: {(Number(order.pointsUsed) || 0) > 0 ? `${order.pointsUsed}` : "-"}
          </span>
        </div>
      </div>
    </div>
  );
};

// Composant pour la modale des commandes en attente
const PendingOrdersModal = ({ orders, items, extraLists, usersData, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Commandes en attente</h3>
          <button
            className="text-gray-500 hover:text-gray-700 text-xl"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {orders.length === 0 ? (
            <p className="text-gray-500 text-center">Aucune commande en attente</p>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                items={items}
                extraLists={extraLists}
                usersData={usersData}
                onShowDetails={() => {}}
                onDragStart={() => {}}
                onDragEnd={() => {}}
              />
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant pour la modale des détails de commande
const OrderDetailsModal = React.memo(({ order, items, extraLists, usersData, onClose, onUpdateFees, onDelete, onUpdateStatus }) => {
  const user = order.userId
    ? usersData.byId[order.userId]
    : order.contact?.phone && usersData.byPhone[order.contact.phone];
  const clientInfo = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Utilisateur inconnu"
    : order.contact?.name || "Client inconnu";
  const phoneNumber = user?.phone || order.address?.phone || order.contact?.phone || "Non spécifié";
  const addressDescription = order.address?.completeAddress || order.destination || "Non spécifiée";
  const additionalAddressInfo = order.address?.instructions || "";
  const orderDate = order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleString("fr-FR") : "Date inconnue";
  const [newStatus, setNewStatus] = useState(order.status || ORDER_STATUS.PENDING);
  const [failureReason, setFailureReason] = useState("");
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [newDeliveryFee, setNewDeliveryFee] = useState(order.deliveryFee || DEFAULT_DELIVERY_FEE);
  const { subtotal, totalWithDelivery } = calculateOrderTotals(order, extraLists, items);

  const getExtraName = (extraListId, index) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    const element = extraList?.extraListElements?.[index];
    return element ? `${element.name}${element.price ? ` (+${formatPrice(element.price)} FCFA)` : ""}` : "Extra inconnu";
  };

  const handleStatusUpdate = async () => {
    if (newStatus === ORDER_STATUS.FAILED && !failureReason) {
      setShowFailureModal(true);
      return;
    }
    try {
      await onUpdateStatus(order.id, newStatus, failureReason);
      setShowFailureModal(false);
      setFailureReason("");
      onClose();
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      setShowFailureModal(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Détails de la commande #{order.id.slice(0, 6)}</h3>
          <button
            className="text-gray-500 hover:text-gray-700 text-xl"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-800">Client</h4>
              <p className="text-gray-600">{clientInfo}</p>
              <p className="text-gray-600">Tel: {phoneNumber}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">Adresse</h4>
              <p className="text-gray-600">{addressDescription}</p>
              {additionalAddressInfo && (
                <p className="text-gray-600">Instructions: {additionalAddressInfo}</p>
              )}
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">Date de commande</h4>
              <p className="text-gray-600">{orderDate}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">Articles</h4>
              {order.items.map((item, index) => {
                const currentItem = items.find((it) => it.id === item.dishId);
                const price = item.price !== undefined && !isNaN(convertPrice(item.price))
                  ? convertPrice(item.price)
                  : item.dishPrice !== undefined && !isNaN(convertPrice(item.dishPrice))
                  ? convertPrice(item.dishPrice)
                  : currentItem?.price
                  ? convertPrice(currentItem.price)
                  : 0;
                return (
                  <div key={`${item.dishId}-${index}`} className="mb-2">
                    <div className="flex justify-between">
                      <span>{currentItem?.name || item.dishName || "Plat inconnu"}</span>
                      <span>{formatPrice(price)} FCFA × {item.quantity}</span>
                    </div>
                    {item.selectedExtras && (
                      <div className="text-gray-600 text-xs ml-2">
                        {Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
                          <div key={extraListId}>
                            {indexes.map((index) => getExtraName(extraListId, index)).join(", ")}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">Résumé financier</h4>
              <div className="text-gray-600">
                <div className="flex justify-between">
                  <span>Sous-total:</span>
                  <span>{formatPrice(subtotal)} FCFA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Frais de livraison:</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      className="w-24 p-1 border rounded-lg"
                      value={newDeliveryFee}
                      onChange={(e) => setNewDeliveryFee(Number(e.target.value))}
                    />
                    <button
                      className="bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700"
                      onClick={() => onUpdateFees(order.id, newDeliveryFee)}
                    >
                      Mettre à jour
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Réduction points:</span>
                  <span className="text-red-600">{formatPrice(Number(order.pointsReduction) || 0)} FCFA</span>
                </div>
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Total:</span>
                  <span>{formatPrice(totalWithDelivery)} FCFA</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">Statut</h4>
              <select
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {Object.values(ORDER_STATUS).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              {newStatus === ORDER_STATUS.FAILED && showFailureModal && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700">Raison de l'échec</label>
                  <select
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                  >
                    <option value="">Sélectionner une raison</option>
                    {FAILURE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          <button
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            onClick={() => onDelete(order.id)}
          >
            Supprimer
          </button>
          <div className="flex space-x-2">
            <button
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              onClick={handleStatusUpdate}
            >
              Mettre à jour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// Composant principal
const OrdersAndFeedback = () => {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [usersData, setUsersData] = useState({ byId: {}, byPhone: {} });
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Récupérer l'ID du restaurant
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "restaurants"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const restaurantDoc = querySnapshot.docs[0];
          setCurrentRestaurantId(restaurantDoc.id);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Récupérer les données des commandes, plats, extras et feedbacks
  useEffect(() => {
    if (!currentRestaurantId) return;
    const unsubscribeOrders = onSnapshot(
      query(collection(db, "orders"), where("restaurantId", "==", currentRestaurantId)),
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersData);
      },
      (err) => setError("Erreur lors de la récupération des commandes")
    );

    const unsubscribeItems = onSnapshot(
      query(collection(db, "items"), where("restaurantId", "==", currentRestaurantId)),
      (snapshot) => {
        const itemsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setItems(itemsData);
      },
      (err) => setError("Erreur lors de la récupération des plats")
    );

    const unsubscribeExtraLists = onSnapshot(
      query(collection(db, "extraLists"), where("restaurantId", "==", currentRestaurantId)),
      (snapshot) => {
        const extraListsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setExtraLists(extraListsData);
      },
      (err) => setError("Erreur lors de la récupération des extras")
    );

    const unsubscribeFeedbacks = onSnapshot(
      query(collection(db, "feedbacks"), where("restaurantId", "==", currentRestaurantId)),
      (snapshot) => {
        const feedbacksData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setFeedbacks(feedbacksData);
      },
      (err) => setError("Erreur lors de la récupération des feedbacks")
    );

    const fetchUsers = async () => {
      const usersQuery = query(collection(db, "users"));
      const usersSnapshot = await getDocs(usersQuery);
      const usersById = {};
      const usersByPhone = {};
      usersSnapshot.forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        usersById[doc.id] = userData;
        if (userData.phone) {
          usersByPhone[userData.phone] = userData;
        }
      });
      setUsersData({ byId: usersById, byPhone: usersByPhone });
    };
    fetchUsers();

    return () => {
      unsubscribeOrders();
      unsubscribeItems();
      unsubscribeExtraLists();
      unsubscribeFeedbacks();
    };
  }, [currentRestaurantId]);

  // Fonctions de mise à jour
  const updateOrderStatus = async (orderId, newStatus, failureReason = "") => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const updates = { status: newStatus, updatedAt: Timestamp.now() };
      if (newStatus === ORDER_STATUS.FAILED && failureReason) {
        updates.failureReason = failureReason;
      }
      if (newStatus === ORDER_STATUS.DELIVERED) {
        const orderDoc = await getDoc(orderRef);
        const orderData = orderDoc.data();
        if (orderData.userId) {
          const userRef = doc(db, "users", orderData.userId);
          const userDoc = await getDoc(userRef);
          const currentPoints = userDoc.exists() ? userDoc.data().loyaltyPoints || 0 : 0;
          const newPoints = currentPoints + Math.floor(calculateOrderTotals(orderData, extraLists, items).subtotal / 100);
          await setDoc(userRef, { loyaltyPoints: newPoints }, { merge: true });
        }
      }
      await updateDoc(orderRef, updates);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      setError("Erreur lors de la mise à jour du statut");
    }
  };

  const updateDeliveryFee = async (orderId, newFee) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { deliveryFee: Number(newFee), updatedAt: Timestamp.now() });
    } catch (error) {
      console.error("Erreur lors de la mise à jour des frais:", error);
      setError("Erreur lors de la mise à jour des frais");
    }
  };

  const deleteOrder = async (orderId) => {
    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch (error) {
      console.error("Erreur lors de la suppression de la commande:", error);
      setError("Erreur lors de la suppression de la commande");
    }
  };

  // Gestion du drag and drop
  const handleDragStart = (e, orderId, sourceStatus) => {
    e.dataTransfer.setData("orderId", orderId);
    e.dataTransfer.setData("sourceStatus", sourceStatus);
  };

  const handleDrop = async (e, targetStatus) => {
    const orderId = e.dataTransfer.getData("orderId");
    const sourceStatus = e.dataTransfer.getData("sourceStatus");
    if (orderId && sourceStatus !== targetStatus) {
      await updateOrderStatus(orderId, targetStatus);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Regrouper les commandes par statut
  const ordersByStatus = useMemo(() => {
    const grouped = {};
    Object.values(ORDER_STATUS).forEach((status) => {
      grouped[status] = orders.filter((order) => order.status === status);
    });
    return grouped;
  }, [orders]);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Tableau de bord</h2>
        <nav className="space-y-2">
          <a href="/restaurant-info" className="block p-2 hover:bg-gray-200 rounded-lg">Infos Restaurant</a>
          <a href="/menu-items" className="block p-2 hover:bg-gray-200 rounded-lg">Menus & Plats</a>
          <a href="/orders-feedback" className="block p-2 bg-green-600 text-white rounded-lg">Commandes & Feedback</a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Gestion des Commandes et Feedbacks</h2>
        {loading && (
          <div className="text-center p-4">
            <div
              className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"
              role="status"
            >
              <span className="sr-only">Chargement...</span>
            </div>
          </div>
        )}
        {error && (
          <p className="text-center text-red-600 p-4" role="alert">
            {error}
          </p>
        )}
        {!loading && (
          <div className="space-y-6">
            {/* Création de commande */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Créer une nouvelle commande</h3>
              <CreateOrderForm
                restaurantId={currentRestaurantId}
                items={items}
                extraLists={extraLists}
                users={Object.values(usersData.byId)}
              />
            </div>

            {/* Gestion des commandes */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Commandes</h3>
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  onClick={() => setShowPendingModal(true)}
                >
                  Voir les commandes en attente
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(ordersByStatus).map(([status, statusOrders]) => (
                  <div
                    key={status}
                    className={`p-4 rounded-lg border ${STATUS_COLUMN_COLORS[status] || "bg-gray-100 border-gray-300"}`}
                    onDrop={(e) => handleDrop(e, status)}
                    onDragOver={handleDragOver}
                  >
                    <h4 className="font-semibold text-gray-800 mb-2">{STATUS_LABELS[status]}</h4>
                    {statusOrders.length === 0 ? (
                      <p className="text-gray-500 text-center">Aucune commande</p>
                    ) : (
                      statusOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          items={items}
                          extraLists={extraLists}
                          usersData={usersData}
                          onShowDetails={() => setSelectedOrder(order)}
                          onDragStart={(e) => handleDragStart(e, order.id, order.status)}
                          onDragEnd={() => {}}
                        />
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Gestion des feedbacks */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Feedbacks des clients</h3>
              {feedbacks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucun feedback pour le moment</p>
              ) : (
                <div className="space-y-4">
                  {feedbacks.map((feedback) => (
                    <div
                      key={feedback.id}
                      className="p-4 border rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {usersData.byId[feedback.userId]?.email || "Client anonyme"}
                          </p>
                          <p className="text-sm text-gray-600">{feedback.comment}</p>
                          <p className="text-sm text-gray-500">
                            Note: {feedback.rating} / 5
                          </p>
                          <p className="text-xs text-gray-500">
                            Date: {feedback.timestamp ? new Date(feedback.timestamp.seconds * 1000).toLocaleString("fr-FR") : "Inconnue"}
                          </p>
                        </div>
                        <button
                          className="text-red-600 hover:text-red-800 text-sm"
                          onClick={async () => {
                            if (window.confirm("Voulez-vous vraiment supprimer ce feedback ?")) {
                              await deleteDoc(doc(db, "feedbacks", feedback.id));
                            }
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gestion des points de fidélité */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Gestion des points de fidélité</h3>
              <LoyaltyPointsManager users={Object.values(usersData.byId)} />
            </div>
          </div>
        )}

        {/* Modales */}
        {showPendingModal && (
          <PendingOrdersModal
            orders={ordersByStatus[ORDER_STATUS.PENDING]}
            items={items}
            extraLists={extraLists}
            usersData={usersData}
            onClose={() => setShowPendingModal(false)}
          />
        )}
        {selectedOrder && (
          <OrderDetailsModal
            order={selectedOrder}
            items={items}
            extraLists={extraLists}
            usersData={usersData}
            onClose={() => setSelectedOrder(null)}
            onUpdateFees={updateDeliveryFee}
            onDelete={deleteOrder}
            onUpdateStatus={updateOrderStatus}
          />
        )}
      </div>
    </div>
  );
};

export default OrdersAndFeedback;