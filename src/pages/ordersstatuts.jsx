import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  updateDoc,
  onSnapshot,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { FaStar } from "react-icons/fa";
import PropTypes from "prop-types";

export const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  READY_TO_DELIVER: "pret_a_livrer",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  CANCELLED: "annulee",
  FAILED: "echec",
};

export const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "En attente",
  [ORDER_STATUS.PREPARING]: "En préparation",
  [ORDER_STATUS.DELIVERING]: "En livraison",
  [ORDER_STATUS.DELIVERED]: "Livrée",
  [ORDER_STATUS.CANCELLED]: "Annulée",
  [ORDER_STATUS.FAILED]: "Échec",
};

export const STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-yellow-500 text-white",
  [ORDER_STATUS.PREPARING]: "bg-blue-500 text-white",
  [ORDER_STATUS.DELIVERING]: "bg-orange-500 text-white",
  [ORDER_STATUS.DELIVERED]: "bg-green-600 text-white",
  [ORDER_STATUS.CANCELLED]: "bg-red-600 text-white",
  [ORDER_STATUS.FAILED]: "bg-gray-600 text-white",
};

export const STATUS_COMMENTS = {
  [ORDER_STATUS.PENDING]: "Commande en attente d’être validée",
  [ORDER_STATUS.PREPARING]: "Un livreur vous appelera dès que votre commande sera prête",
  [ORDER_STATUS.DELIVERING]: "Commande en route pour la livraison",
  [ORDER_STATUS.DELIVERED]: "Commande livrée avec succès",
  [ORDER_STATUS.CANCELLED]: "Commande annulée",
  [ORDER_STATUS.FAILED]: "La livraison a échoué (contactez le support)",
};

const DEFAULT_DELIVERY_FEE = 1000;

export const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const formatDate = (timestamp) =>
  timestamp?.seconds
    ? new Date(timestamp.seconds * 1000).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Date non disponible";

export const formatDateForComparison = (date) => date.toISOString().split("T")[0];

const OrderStatus = ({ isAdmin = false }) => {
  const [orders, setOrders] = useState([]);
  const [itemsData, setItemsData] = useState({});
  const [extraLists, setExtraLists] = useState({});
  const [quartiersList, setQuartiersList] = useState([]);
  const [usersData, setUsersData] = useState({ byId: {}, byPhone: {} });
  const [activeTab, setActiveTab] = useState(isAdmin ? ORDER_STATUS.PENDING : ORDER_STATUS.PENDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateFilterMode, setDateFilterMode] = useState("day");
  const navigate = useNavigate();

  const effectiveUserId = useMemo(
    () => currentUserId || localStorage.getItem("guestUid"),
    [currentUserId]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("onAuthStateChanged:", user ? user.uid : null); // Debug
      setCurrentUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  const fetchReferenceData = useCallback(async () => {
    console.log("fetchReferenceData appelé"); // Debug
    try {
      const [items, extras, quartiers, users] = await Promise.all([
        getDocs(collection(db, "items")),
        getDocs(collection(db, "extraLists")),
        getDocs(collection(db, "quartiers")),
        getDocs(collection(db, "usersrestau")),
      ]);

      setItemsData(items.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
      setExtraLists(extras.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
      setQuartiersList(quartiers.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setUsersData({
        byId: users.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}),
        byPhone: users.docs.reduce((acc, doc) => {
          if (doc.data().phone) acc[doc.data().phone] = doc.data();
          return acc;
        }, {}),
      });
    } catch (err) {
      console.error("Erreur de chargement des données:", err);
      setError("Erreur de chargement des données de référence");
    }
  }, []);

  const filterOrdersByDate = useCallback((orders = [], date, mode) => {
    console.log("filterOrdersByDate appelé"); // Debug
    const selected = new Date(date);
    return orders.filter((order) => {
      if (!order.timestamp) return false;
      const orderDate = new Date(order.timestamp.seconds * 1000);

      switch (mode) {
        case "day":
          return formatDateForComparison(orderDate) === formatDateForComparison(selected);
        case "week":
          const startOfWeek = new Date(selected);
          startOfWeek.setDate(selected.getDate() - selected.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return orderDate >= startOfWeek && orderDate <= endOfWeek;
        case "month":
          return (
            orderDate.getMonth() === selected.getMonth() &&
            orderDate.getFullYear() === selected.getFullYear()
          );
        default:
          return true;
      }
    });
  }, []);

  useEffect(() => {
    console.log("useEffect principal exécuté, effectiveUserId:", effectiveUserId); // Debug
    setError("");

    if (!isAdmin && effectiveUserId === null) {
      setError("Vous devez être connecté pour voir vos commandes. Redirection vers la page de connexion...");
      setLoading(false);
      const timer = setTimeout(() => navigate("/profile"), 2000);
      return () => clearTimeout(timer);
    }

    if (!effectiveUserId && !isAdmin) {
      console.log("effectiveUserId non défini, arrêt du useEffect"); // Debug
      setLoading(false);
      return;
    }

    const ordersQuery = isAdmin
      ? collection(db, "orders")
      : query(collection(db, "orders"), where("userId", "==", effectiveUserId));

    setLoading(true);
    fetchReferenceData().then(() => {
      const unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          console.log("onSnapshot déclenché, docs reçus:", snapshot.docs.length); // Debug
          setOrders((prevOrders) => {
            const newOrders = snapshot.docs
              .map((doc) => ({
                id: doc.id,
                ...doc.data(),
                status: doc.data().status || ORDER_STATUS.PENDING,
              }))
              .filter((order) => order.items && Array.isArray(order.items) && order.items.length > 0)
              .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            // Garde-fou pour éviter les rendus inutiles
            if (JSON.stringify(prevOrders) !== JSON.stringify(newOrders)) {
              return newOrders;
            }
            return prevOrders;
          });
          setLoading(false);
        },
        (err) => {
          console.error("Erreur dans l'écoute des commandes:", err);
          setError("Erreur de connexion au suivi des commandes");
          setLoading(false);
        }
      );
      return () => {
        console.log("Désabonnement de onSnapshot"); // Debug
        unsubscribe();
      };
    });
  }, [isAdmin, effectiveUserId, navigate, fetchReferenceData]);

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const dateFilteredOrders = isAdmin ? filterOrdersByDate(orders, selectedDate, dateFilterMode) : orders;
    return dateFilteredOrders.filter((order) => order.status === activeTab);
  }, [orders, activeTab, isAdmin, selectedDate, dateFilterMode, filterOrdersByDate]);

  const statusCounts = useMemo(() => {
    if (!Array.isArray(orders)) return {};
    return Object.keys(STATUS_LABELS).reduce((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status).length;
      return acc;
    }, {});
  }, [orders]);

  const getDeliveryFee = useCallback((area) => {
    if (!area) return DEFAULT_DELIVERY_FEE;
    const quartier = quartiersList.find((q) => q.name.toLowerCase() === area.toLowerCase());
    return quartier ? Number(quartier.fee) : DEFAULT_DELIVERY_FEE;
  }, [quartiersList]);

  const calculateTotal = useCallback((order) => {
    if (!order || !Array.isArray(order.items)) return 0;
    const itemsTotal = order.items.reduce((sum, item) => {
      const itemPrice = Number(item.dishPrice || itemsData[item.dishId]?.price || 0);
      const extrasTotal = item.selectedExtras
        ? Object.entries(item.selectedExtras).reduce((extraSum, [extraListId, indexes]) => {
            const extraList = extraLists[extraListId]?.extraListElements || [];
            return extraSum + indexes.reduce((acc, index) => {
              return acc + Number(extraList[index]?.price || 0);
            }, 0);
          }, 0)
        : 0;
      return sum + (itemPrice + extrasTotal) * Number(item.quantity || 1);
    }, 0);
    const deliveryFee = Number(order.deliveryFee) || getDeliveryFee(order.address?.area);
    const pointsReduction = Number(order.pointsReduction) || 0;
    return Math.max(0, itemsTotal + deliveryFee - pointsReduction);
  }, [itemsData, extraLists, getDeliveryFee]);

  const handleDragStart = useCallback((e, order) => {
    e.dataTransfer.setData("orderId", order.id);
    setDraggedOrder(order);
    e.currentTarget.classList.add("opacity-50");
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.classList.remove("opacity-50");
  }, []);

  const handleDrop = useCallback(async (e, newStatus) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData("orderId");
    if (!orderId || draggedOrder?.status === newStatus || !isAdmin) {
      setError("Action non autorisée ou statut inchangé.");
      return;
    }

    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error("Commande non trouvée");

      const oldStatus = order.status;
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });

      if (order.userId) {
        const notificationRef = doc(collection(db, "notifications"));
        await setDoc(notificationRef, {
          userId: order.userId,
          orderId: orderId,
          oldStatus,
          newStatus,
          itemNames: order.items
            .map((item) => item.dishName || itemsData[item.dishId]?.name || "Article inconnu")
            .join(", "),
          pointsUsed: order.pointsUsed || 0,
          pointsReduction: order.pointsReduction || 0,
          timestamp: Timestamp.now(),
          read: false,
        });
      }

      setError(null);
      setDraggedOrder(null);
    } catch (error) {
      console.error("Erreur de mise à jour du statut ou création de notification:", error);
      setError("Impossible de mettre à jour le statut ou d’envoyer la notification");
    }
  }, [orders, isAdmin, itemsData, draggedOrder]);

  const updateOrderDeliveryFees = useCallback(async (orderId, area, newFee) => {
    const feeNumber = Number(newFee);
    if (isNaN(feeNumber) || feeNumber < 0) {
      setError("Frais de livraison invalides.");
      return;
    }

    try {
      const orderRef = doc(db, "orders", orderId);
      if (isAdmin && !quartiersList.some((q) => q.name.toLowerCase() === area.toLowerCase())) {
        const newQuartierRef = doc(collection(db, "quartiers"));
        await setDoc(newQuartierRef, { name: area, fee: feeNumber });
        setQuartiersList((prev) => [...prev, { id: newQuartierRef.id, name: area, fee: feeNumber }]);
      }
      await updateDoc(orderRef, { deliveryFee: feeNumber, updatedAt: Timestamp.now() });
    } catch (error) {
      console.error("Erreur de mise à jour des frais:", error);
      setError("Erreur lors de la mise à jour des frais");
    }
  }, [isAdmin, quartiersList]);

  const handlePreviousPeriod = useCallback(() => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === "day") newDate.setDate(newDate.getDate() - 1);
    else if (dateFilterMode === "week") newDate.setDate(newDate.getDate() - 7);
    else if (dateFilterMode === "month") newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  }, [dateFilterMode, selectedDate]);

  const handleNextPeriod = useCallback(() => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === "day") newDate.setDate(newDate.getDate() + 1);
    else if (dateFilterMode === "week") newDate.setDate(newDate.getDate() + 7);
    else if (dateFilterMode === "month") newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  }, [dateFilterMode, selectedDate]);

  const renderTabs = () => (
    <div className="p-4">
      {isAdmin && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Gestion des Commandes</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                onClick={handlePreviousPeriod}
                aria-label="Période précédente"
              >
                {"<"}
              </button>
              <input
                type="date"
                value={formatDateForComparison(selectedDate)}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="border rounded px-2 py-1"
                aria-label="Sélectionner une date"
              />
              <button
                className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                onClick={handleNextPeriod}
                aria-label="Période suivante"
              >
                {">"}
              </button>
            </div>
            <select
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value)}
              className="border rounded px-2 py-1"
              aria-label="Mode de filtrage par date"
            >
              <option value="day">Jour</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
            </select>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-6 border-b" role="tablist">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <button
            key={status}
            onClick={() => setActiveTab(status)}
            role="tab"
            aria-selected={activeTab === status}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
              activeTab === status
                ? `${STATUS_COLORS[status]} border-b-2 border-white`
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {label} ({statusCounts[status] || 0})
          </button>
        ))}
      </div>
      <div className="max-w-5xl mx-auto">
        {filteredOrders.length === 0 ? (
          <p className="text-center text-gray-500 py-10">Aucune commande dans cet état</p>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              itemsData={itemsData}
              extraLists={extraLists}
              formatDate={formatDate}
              badgeClasses={STATUS_COLORS}
              isAdmin={isAdmin}
              onUpdateFees={updateOrderDeliveryFees}
              deliveryFee={getDeliveryFee(order.address?.area)}
              usersData={usersData}
              calculateTotal={calculateTotal}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, order.status)}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white border-b p-4 shadow-sm">
        <h2 className="text-center font-bold text-2xl">
          {isAdmin ? "Tableau de bord des commandes" : "Mes commandes"}
        </h2>
      </header>
      {loading && (
        <div className="flex flex-col items-center justify-center p-4">
          <svg
            className="animate-spin h-12 w-12 text-green-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="Chargement"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="mt-2 text-gray-600">Chargement des commandes...</span>
        </div>
      )}
      {error && (
        <p className="text-center text-red-600 p-4" role="alert">
          {error}
        </p>
      )}
      {!loading && orders.length === 0 && (
        <p className="text-center text-gray-500 p-4">
          {isAdmin ? "Aucune commande trouvée" : "Vous n’avez aucune commande"}
        </p>
      )}
      {!loading && orders.length > 0 && renderTabs()}
      <Footer />
    </div>
  );
};

OrderStatus.propTypes = {
  isAdmin: PropTypes.bool,
};

OrderStatus.defaultProps = {
  isAdmin: false,
};

const OrderCard = ({
  order,
  itemsData,
  extraLists,
  formatDate,
  badgeClasses,
  isAdmin,
  onUpdateFees,
  deliveryFee,
  usersData,
  calculateTotal,
  onDragStart,
  onDragEnd,
  onDrop,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const navigate = useNavigate();

  const user = order.userId
    ? usersData.byId[order.userId]
    : order.contact?.phone && usersData.byPhone[order.contact.phone];
  const clientName =
    user
      ? `${user.lastName || ""} ${user.firstName || ""} ${user.email || ""}`.trim() ||
        "Utilisateur inconnu"
      : order.contact?.name || "Client inconnu";
  const phoneNumber =
    user?.phone || order.address?.phone || order.contact?.phone || "Non fourni";

  const handleConfirmDelivery = async () => {
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: ORDER_STATUS.DELIVERED,
        updatedAt: Timestamp.now(),
      });

      if (window.fbq) {
        window.fbq("track", "Purchase", {
          value: calculateTotal(order),
          currency: "XAF",
          content_ids: order.items.map((item) => item.dishId),
          content_type: "product",
          order_id: order.id,
        });
      }

      setShowConfirmModal(false);
      navigate(`/thank-you/${order.id}`);
    } catch (error) {
      console.error("Erreur lors de la confirmation de la livraison:", error);
      setPaymentError("Erreur lors de la confirmation de la livraison");
    }
  };

  return (
    <div
      draggable={isAdmin}
      onDragStart={(e) => isAdmin && onDragStart(e, order)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.classList.add("bg-gray-200");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("bg-gray-200")}
      onDrop={onDrop}
      className="mb-6 bg-white rounded-lg shadow-lg p-4 cursor-move"
    >
      <div className="flex flex-wrap items-center gap-4 border-b pb-3 mb-3">
        <span className={`px-3 py-1 rounded-full text-sm ${badgeClasses[order.status]}`}>
          {STATUS_LABELS[order.status] || "En attente"}
        </span>
        <div className="ml-auto text-sm text-gray-500">{formatDate(order.timestamp)}</div>
      </div>
      <p className="text-sm text-gray-600 mb-3 italic">{STATUS_COMMENTS[order.status]}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500">N° de commande</p>
          <p className="font-medium">#{order.id.slice(0, 8)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total (avec livraison)</p>
          <p className="font-medium text-green-600">{formatPrice(calculateTotal(order))} FCFA</p>
          {order.pointsUsed > 0 && (
            <p className="text-sm text-gray-600">
              Réduction : {formatPrice(order.pointsReduction)} FCFA ({formatPrice(order.pointsUsed)} points)
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">Livraison</p>
          <div className="flex items-center">
            <div>
              <p className="font-medium">{order.address?.area || "Non spécifié"}</p>
              <p className="text-sm">{formatPrice(order.deliveryFee || deliveryFee)} FCFA</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  const newFee = prompt(
                    `Frais pour ${order.address?.area || "inconnu"} (FCFA):`,
                    order.deliveryFee || deliveryFee
                  );
                  if (newFee !== null) onUpdateFees(order.id, order.address?.area || "inconnu", newFee);
                }}
                className="ml-2 text-xs p-1 bg-gray-200 rounded hover:bg-gray-300"
                aria-label="Modifier les frais de livraison"
              >
                ✏️
              </button>
            )}
          </div>
        </div>
      </div>
      {order.loyaltyPoints > 0 && (
        <div className="mb-4 bg-gray-50 p-2 rounded">
          <p className="text-sm font-bold">Points de fidélité :</p>
          <p className="text-sm">
            Gagnés : {formatPrice(order.loyaltyPoints)} points
            {isAdmin ? " (à valider après paiement)" : " (crédités après validation du paiement)"}
          </p>
        </div>
      )}
      <div className="mb-4 bg-gray-50 p-2 rounded">
        <p className="text-sm font-bold">Coordonnées :</p>
        <p className="text-sm">{clientName} - {phoneNumber}</p>
      </div>
      <div className="mb-4">
        <h6 className="font-bold mb-3">Articles :</h6>
        <ul className="space-y-4">
          {Array.isArray(order.items) && order.items.length > 0 ? (
            order.items.map((item, index) => (
              <OrderItem key={index} item={item} itemsData={itemsData} extraLists={extraLists} />
            ))
          ) : (
            <li className="text-gray-500">Aucun article</li>
          )}
        </ul>
      </div>
      {!isAdmin && order.status === ORDER_STATUS.DELIVERING && (
        <div className="flex gap-4">
          <button
            onClick={() => setShowConfirmModal(true)}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition mt-2"
            aria-label="Confirmer la livraison"
          >
            Confirmer la livraison
          </button>
          <button
            onClick={() => updateDoc(doc(db, "orders", order.id), { status: ORDER_STATUS.FAILED })}
            className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition mt-2"
            aria-label="Signaler un problème"
          >
            Signaler un problème
          </button>
        </div>
      )}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h5 className="font-semibold mb-4">Confirmer la réception de votre commande</h5>
            <p className="text-sm text-gray-600 mb-6">
              Avez-vous bien reçu votre commande #{order.id.slice(0, 8)} ?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                aria-label="Annuler la confirmation"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelivery}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                aria-label="Confirmer la réception"
              >
                Oui, confirmer
              </button>
            </div>
          </div>
        </div>
      )}
      {paymentError && (
        <p className="text-red-600 text-sm mt-2" role="alert">
          {paymentError}
        </p>
      )}
    </div>
  );
};

OrderCard.propTypes = {
  order: PropTypes.object.isRequired,
  itemsData: PropTypes.object,
  extraLists: PropTypes.object,
  formatDate: PropTypes.func.isRequired,
  badgeClasses: PropTypes.object.isRequired,
  isAdmin: PropTypes.bool,
  onUpdateFees: PropTypes.func.isRequired,
  deliveryFee: PropTypes.number,
  usersData: PropTypes.object.isRequired,
  calculateTotal: PropTypes.func.isRequired,
  onDragStart: PropTypes.func,
  onDragEnd: PropTypes.func,
  onDrop: PropTypes.func,
};

const OrderItem = ({ item, itemsData, extraLists }) => {
  const itemPrice = Number(item.dishPrice || itemsData[item.dishId]?.price || 0);
  const quantity = Number(item.quantity || 1);
  const extrasTotal = item.selectedExtras
    ? Object.entries(item.selectedExtras).reduce((sum, [extraListId, indexes]) => {
        const extraList = extraLists[extraListId]?.extraListElements || [];
        return sum + indexes.reduce((acc, index) => acc + Number(extraList[index]?.price || 0), 0);
      }, 0)
    : 0;

  return (
    <li className="pb-2 border-b border-gray-100">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">{item.dishName || itemsData[item.dishId]?.name || "Article inconnu"}</p>
          <p className="text-sm text-gray-500">Quantité : {quantity}</p>
        </div>
        <p className="text-sm text-green-600">+{formatPrice((itemPrice + extrasTotal) * quantity)} FCFA</p>
      </div>
      {item.selectedExtras && (
        <div className="ml-4 mt-2 text-sm text-gray-600">
          {Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
            <div key={extraListId}>
              <p className="font-medium">{extraLists[extraListId]?.name || "Options"} :</p>
              <ul className="list-disc list-inside ml-2">
                {indexes.map((index) => {
                  const extra = extraLists[extraListId]?.extraListElements?.[index] || {};
                  return (
                    <li key={index} className="flex justify-between">
                      <span>{extra.name || "Option supprimée"}</span>
                      {extra.price > 0 && (
                        <span className="text-green-500 ml-2">
                          +{formatPrice(extra.price * quantity)} FCFA
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </li>
  );
};

OrderItem.propTypes = {
  item: PropTypes.object.isRequired,
  itemsData: PropTypes.object,
  extraLists: PropTypes.object,
};

const Footer = () => (
  <footer className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg">
    <div className="grid grid-cols-4">
      {[
        { to: "/accueil", icon: "fas fa-home", label: "Accueil" },
        { to: "/cart", icon: "fas fa-shopping-cart", label: "Panier" },
        { to: "/complete_order", icon: "fas fa-shopping-bag", label: "Commandes" },
        { to: "/profile", icon: "fas fa-user", label: "Compte" },
      ].map(({ to, icon, label }) => (
        <Link key={to} to={to} className="text-gray-700 p-2 hover:text-green-600 transition-colors">
          <i className={`${icon} text-lg`} aria-hidden="true"></i>
          <span className="block text-xs mt-1">{label}</span>
        </Link>
      ))}
    </div>
  </footer>
);

const ThankYouPage = () => {
  const { orderId } = useParams();
  const [feedback, setFeedback] = useState({
    recommend: null,
    deliveryService: 0,
    foodQuality: 0,
    pointsExperience: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [orderName, setOrderName] = useState("votre commande");
  const [restaurantName, setRestaurantName] = useState("le restaurant");
  const [deliveryPersonName, setDeliveryPersonName] = useState("votre livreur");
  const [pointsUsed, setPointsUsed] = useState(0);
  const [pointsReduction, setPointsReduction] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

  useEffect(() => {
    if (!orderId) {
      setError("ID de commande manquant.");
      return;
    }

    const fetchOrderDetails = async () => {
      try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          const items = Array.isArray(orderData.items) ? orderData.items : [];
          const firstItemName = items.length > 0 ? items[0].dishName || "Commande" : "Commande";
          setOrderName(`${firstItemName}${items.length > 1 ? " et plus" : ""}`);
          setRestaurantName(orderData.restaurantName || "le restaurant");
          setDeliveryPersonName(orderData.deliveryPersonName || "votre livreur");
          setPointsUsed(orderData.pointsUsed || 0);
          setPointsReduction(orderData.pointsReduction || 0);
          setLoyaltyPoints(orderData.loyaltyPoints || 0);
        } else {
          setError("Commande non trouvée.");
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des détails:", err);
        setError("Erreur lors du chargement des détails de la commande.");
      }
    };

    fetchOrderDetails();
  }, [orderId]);

  const handleRatingChange = useCallback((category, value) => {
    setFeedback((prev) => ({ ...prev, [category]: value }));
  }, []);

  const handleRecommendationChange = useCallback((value) => {
    setFeedback((prev) => ({ ...prev, recommend: value }));
  }, []);

  const handlePointsExperienceChange = useCallback((e) => {
    setFeedback((prev) => ({ ...prev, pointsExperience: e.target.value }));
  }, []);

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setError(null);
    if (!orderId) {
      setError("ID de commande manquant.");
      return;
    }
    if (feedback.recommend === null || feedback.deliveryService === 0 || feedback.foodQuality === 0) {
      setError("Veuillez compléter toutes les évaluations.");
      return;
    }
    try {
      const feedbackRef = doc(collection(db, "feedback"));
      await setDoc(feedbackRef, {
        orderId,
        userId: localStorage.getItem("guestUid") || null,
        ...feedback,
        timestamp: Timestamp.now(),
      });

      if (window.fbq) {
        window.fbq("track", "CompleteRegistration", {
          content_name: "Feedback Submission",
          order_id: orderId,
          value: feedback.recommend ? 1 : 0,
          currency: "XAF",
        });
      }

      setSubmitted(true);
    } catch (error) {
      console.error("Erreur lors de l’envoi du feedback:", error);
      setError("Erreur lors de l’envoi du feedback. Veuillez réessayer.");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Merci pour votre avis !</h2>
          <p className="text-gray-600 mb-6">Bon appétit !</p>
          <Link
            to="/complete_order"
            className="text-gray-600 hover:text-gray-800 underline"
            aria-label="Retour aux commandes"
          >
            Retour aux commandes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-between p-4">
      <div className="w-full max-w-md flex-1 flex flex-col justify-start">
        <div className="flex justify-between items-center mb-8">
          <Link to="/accueil" className="text-gray-600 text-lg" aria-label="Retour à l'accueil"></Link>
          <h2 className="text-sm text-gray-500">Noter votre livraison</h2>
          <Link to="/accueil" className="text-gray-600 text-sm" aria-label="Retour à l'accueil"></Link>
        </div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Merci pour votre confiance !
          </h2>
          <p className="text-xl font-medium text-green-600">
            Bon appétit à vous !
          </p>
        </div>
        {(pointsUsed > 0 || loyaltyPoints > 0) && (
          <div className="mb-8 text-center bg-gray-100 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Points de fidélité
            </h3>
            {pointsUsed > 0 && (
              <p className="text-sm text-gray-600">
                Vous avez utilisé {formatPrice(pointsUsed)} points pour une réduction de {formatPrice(pointsReduction)} FCFA.
              </p>
            )}
            {loyaltyPoints > 0 && (
              <p className="text-sm text-gray-600">
                Vous avez gagné {formatPrice(loyaltyPoints)} points pour cette commande (crédités après validation).
              </p>
            )}
          </div>
        )}
        <div className="w-full border-t border-gray-300 mb-8"></div>
        <div className="mb-12 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Recommanderiez-vous notre service ?
          </h3>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => handleRecommendationChange(true)}
              className={`px-6 py-2 rounded-full border-2 font-semibold text-lg transition-colors ${
                feedback.recommend === true
                  ? "border-green-500 text-green-500"
                  : "border-gray-300 text-gray-500 hover:border-gray-400"
              }`}
              aria-label="Recommander le service"
            >
              Oui
            </button>
            <button
              type="button"
              onClick={() => handleRecommendationChange(false)}
              className={`px-6 py-2 rounded-full border-2 font-semibold text-lg transition-colors ${
                feedback.recommend === false
                  ? "border-red-500 text-red-500"
                  : "border-gray-300 text-gray-500 hover:border-gray-400"
              }`}
              aria-label="Ne pas recommander le service"
            >
              Non
            </button>
          </div>
        </div>
        <div className="mb-12 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Comment était votre livraison avec {deliveryPersonName} ?
          </h3>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <FaStar
                key={value}
                size={40}
                className={`cursor-pointer transition-colors ${
                  value <= feedback.deliveryService ? "text-yellow-400" : "text-gray-300"
                }`}
                onClick={() => handleRatingChange("deliveryService", value)}
                aria-label={`Noter la livraison ${value} étoile${value > 1 ? "s" : ""}`}
              />
            ))}
          </div>
        </div>
        <div className="mb-12 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Noter le système de commande ?
          </h3>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <FaStar
                key={value}
                size={40}
                className={`cursor-pointer transition-colors ${
                  value <= feedback.foodQuality ? "text-yellow-400" : "text-gray-300"
                }`}
                onClick={() => handleRatingChange("foodQuality", value)}
                aria-label={`Noter la qualité des plats ${value} étoile${value > 1 ? "s" : ""}`}
              />
            ))}
          </div>
        </div>
        {(pointsUsed > 0 || loyaltyPoints > 0) && (
          <div className="mb-12 text-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Comment était votre expérience avec les points de fidélité ?
            </h3>
            <textarea
              value={feedback.pointsExperience}
              onChange={handlePointsExperienceChange}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Partagez vos commentaires sur l'utilisation des points (facultatif)"
              rows="4"
              aria-label="Commentaires sur les points de fidélité"
            />
          </div>
        )}
        {error && (
          <p className="text-red-600 text-center mb-4" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        onClick={handleSubmitFeedback}
        className="w-full max-w-md py-4 bg-red-500 text-white text-lg font-semibold rounded-full hover:bg-red-600 transition duration-300"
        aria-label="Soumettre le feedback"
      >
        Soumettre
      </button>
    </div>
  );
};

ThankYouPage.propTypes = {
  orderId: PropTypes.string,
};

export { ThankYouPage };
export default OrderStatus;