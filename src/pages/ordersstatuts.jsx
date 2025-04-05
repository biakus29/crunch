import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  onSnapshot,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  READY_TO_DELIVER: "pret_a_livrer",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  CANCELLED: "annulee",
};

const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "En attente",
  [ORDER_STATUS.PREPARING]: "En préparation",
  
  [ORDER_STATUS.DELIVERING]: "En livraison",
  [ORDER_STATUS.DELIVERED]: "Livrée",
  [ORDER_STATUS.CANCELLED]: "Annulée",
};

const STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-yellow-500 text-white",
  [ORDER_STATUS.PREPARING]: "bg-blue-500 text-white",
  
  [ORDER_STATUS.DELIVERING]: "bg-orange-500 text-white",
  [ORDER_STATUS.DELIVERED]: "bg-green-600 text-white",
  [ORDER_STATUS.CANCELLED]: "bg-red-600 text-white",
};

// Commentaires spécifiques pour chaque état
const STATUS_COMMENTS = {
  [ORDER_STATUS.PENDING]: "Commande en attente d’être validée",
  [ORDER_STATUS.PREPARING]: "Un livreur vous appelera dès que votre commande sera prête",

  [ORDER_STATUS.DELIVERING]: "Commande en route pour la livraison",
  [ORDER_STATUS.DELIVERED]: "Commande livrée avec succès",
  [ORDER_STATUS.CANCELLED]: "Commande annulée",
};

const DEFAULT_DELIVERY_FEE = 1000;

const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const formatDate = (timestamp) =>
  timestamp?.seconds
    ? new Date(timestamp.seconds * 1000).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Date non disponible";

const formatDateForComparison = (date) => date.toISOString().split("T")[0];

const OrderStatus = ({ isAdmin = false }) => {
  const [orders, setOrders] = useState([]);
  const [itemsData, setItemsData] = useState({});
  const [extraLists, setExtraLists] = useState({});
  const [deliveryFees, setDeliveryFees] = useState({});
  const [usersData, setUsersData] = useState({ byId: {}, byPhone: {} });
  const [activeTab, setActiveTab] = useState(isAdmin ? ORDER_STATUS.PENDING : ORDER_STATUS.PENDING); // Onglet actif
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateFilterMode, setDateFilterMode] = useState("day");

  const effectiveUserId = useMemo(
    () => currentUserId || localStorage.getItem("guestUid"),
    [currentUserId]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  const fetchReferenceData = async () => {
    try {
      const [items, extras, fees, users] = await Promise.all([
        getDocs(collection(db, "items")),
        getDocs(collection(db, "extraLists")),
        getDocs(collection(db, "quartiers")),
        getDocs(collection(db, "usersrestau")),
      ]);

      setItemsData(items.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
      setExtraLists(extras.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
      setDeliveryFees(fees.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data().fee }), {}));
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
  };

  const filterOrdersByDate = (orders, date, mode) => {
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
  };

  useEffect(() => {
    if (effectiveUserId === null && !isAdmin) return;

    const ordersQuery = isAdmin
      ? collection(db, "orders")
      : query(collection(db, "orders"), where("userId", "==", effectiveUserId));

    setLoading(true);
    fetchReferenceData().then(() => {
      const unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          const allOrders = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            status: doc.data().status || ORDER_STATUS.PENDING,
          }));
          setOrders(allOrders);
          setLoading(false);
        },
        (err) => {
          console.error("Erreur dans l'écoute des commandes:", err);
          setError("Erreur de connexion au suivi des commandes");
          setLoading(false);
        }
      );
      return () => unsubscribe();
    });
  }, [isAdmin, effectiveUserId]);

  const filteredOrders = useMemo(() => {
    const dateFilteredOrders = isAdmin ? filterOrdersByDate(orders, selectedDate, dateFilterMode) : orders;
    return dateFilteredOrders.filter((order) => order.status === activeTab);
  }, [orders, activeTab, isAdmin, selectedDate, dateFilterMode]);

  const statusCounts = useMemo(() => {
    return Object.keys(STATUS_LABELS).reduce((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status).length;
      return acc;
    }, {});
  }, [orders]);

  const calculateTotal = (order) => {
    if (order.total !== undefined && order.total !== null) {
      return Number(order.total);
    }
    const itemsTotal = order.items?.reduce((sum, item) => {
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
    }, 0) || 0;
    const deliveryFee = Number(order.deliveryFees || getDeliveryFee(order.destination));
    return itemsTotal + deliveryFee;
  };

  const getDeliveryFee = (destination) => Number(deliveryFees[destination] || DEFAULT_DELIVERY_FEE);

  const handleDragStart = (e, order) => {
    e.dataTransfer.setData("orderId", order.id);
    setDraggedOrder(order);
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e) => e.currentTarget.classList.remove("opacity-50");

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData("orderId");
    if (!orderId || draggedOrder?.status === newStatus) return;

    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error("Commande non trouvée");

      const oldStatus = order.status;

      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });

      const itemNames = order.items
        ?.map((item) => item.dishName || itemsData[item.dishId]?.name || "Article inconnu")
        .join(", ");

      if (order.userId) {
        const notificationRef = doc(collection(db, "notifications"));
        await setDoc(notificationRef, {
          userId: order.userId,
          orderId: orderId,
          oldStatus: oldStatus,
          newStatus: newStatus,
          itemNames: itemNames,
          timestamp: Timestamp.now(),
          read: false,
        });
      }

      setDraggedOrder(null);
    } catch (error) {
      console.error("Erreur de mise à jour du statut ou création de notification:", error);
      setError("Impossible de mettre à jour le statut ou d'envoyer la notification");
    }
  };

  const updateOrderDeliveryFees = async (orderId, destination, newFee) => {
    const feeNumber = Number(newFee);
    if (isNaN(feeNumber) || feeNumber < 0) return;

    try {
      const orderRef = doc(db, "orders", orderId);
      if (isAdmin && !(destination in deliveryFees)) {
        await setDoc(doc(db, "quartiers", destination), { fee: feeNumber, name: destination });
        setDeliveryFees((prev) => ({ ...prev, [destination]: feeNumber }));
      }
      await updateDoc(orderRef, { deliveryFees: feeNumber, updatedAt: Timestamp.now() });
    } catch (error) {
      console.error("Erreur de mise à jour des frais:", error);
      setError("Erreur lors de la mise à jour des frais");
    }
  };

  const handlePreviousPeriod = () => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === "day") newDate.setDate(newDate.getDate() - 1);
    else if (dateFilterMode === "week") newDate.setDate(newDate.getDate() - 7);
    else if (dateFilterMode === "month") newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === "day") newDate.setDate(newDate.getDate() + 1);
    else if (dateFilterMode === "week") newDate.setDate(newDate.getDate() + 7);
    else if (dateFilterMode === "month") newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

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
              >
                {"<"}
              </button>
              <input
                type="date"
                value={formatDateForComparison(selectedDate)}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="border rounded px-2 py-1"
              />
              <button
                className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                onClick={handleNextPeriod}
              >
                {">"}
              </button>
            </div>
            <select
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="day">Jour</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
            </select>
          </div>
        </div>
      )}
      {/* Onglets */}
      <div className="flex flex-wrap gap-2 mb-6 border-b">
        {Object.entries(STATUS_LABELS)
          .filter(([status]) => status !== ORDER_STATUS.CANCELLED || isAdmin)
          .map(([status, label]) => (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                activeTab === status
                  ? `${STATUS_COLORS[status]} border-b-2 border-white`
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label} ({statusCounts[status]})
            </button>
          ))}
      </div>
      {/* Contenu de l’onglet actif */}
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
              deliveryFee={getDeliveryFee(order.destination)}
              usersData={usersData}
              calculateTotal={calculateTotal}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, order.status)} // Permettre le drop dans le même onglet
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
      {!loading && orders.length === 0 && (
        <p className="text-center text-gray-500 p-4">
          {isAdmin ? "Aucune commande trouvée" : "Vous n'avez aucune commande"}
        </p>
      )}
      {!loading && orders.length > 0 && renderTabs()}
      <Footer />
    </div>
  );
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
  const user = order.userId
    ? usersData.byId[order.userId]
    : order.contact?.phone && usersData.byPhone[order.contact.phone];
  const clientName = user
    ? `${user.email || ""} ${user.lastName || ""}`.trim() || "Utilisateur inconnu"
    : order.contact?.name || "Client inconnu";
  const phoneNumber = user?.phone || order.address?.phone || order.contact?.phone || "Non fourni";

  return (
    <div
      draggable={isAdmin} // Activer le glisser-déposer uniquement pour les admins
      onDragStart={(e) => isAdmin && onDragStart(e, order)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="mb-6 bg-white rounded-lg shadow-lg p-4 cursor-move"
    >
      <div className="flex flex-wrap items-center gap-4 border-b pb-3 mb-3">
        <span className={`px-3 py-1 rounded-full text-sm ${badgeClasses[order.status]}`}>
          {STATUS_LABELS[order.status] || "En attente"}
        </span>
        <div className="ml-auto text-sm text-gray-500">{formatDate(order.timestamp)}</div>
      </div>
      {/* Commentaire spécifique à l’état */}
      <p className="text-sm text-gray-600 mb-3 italic">{STATUS_COMMENTS[order.status]}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500">N° de commande</p>
          <p className="font-medium">#{order.id.slice(0, 8)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total</p>
          <p className="font-medium text-green-600">{formatPrice(calculateTotal(order))} FCFA</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Livraison</p>
          <div className="flex items-center">
            <div>
              <p className="font-medium">{order.destination || "Non spécifié"}</p>
              <p className="text-sm">{formatPrice(order.deliveryFees || deliveryFee)} FCFA</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  const newFee = prompt(
                    `Frais pour ${order.destination || "inconnu"} (FCFA):`,
                    order.deliveryFees || deliveryFee
                  );
                  if (newFee !== null) onUpdateFees(order.id, order.destination || "inconnu", newFee);
                }}
                className="ml-2 text-xs p-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                ✏️
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="mb-4 bg-gray-50 p-2 rounded">
        <p className="text-sm font-bold">Coordonnées :</p>
        <p className="text-sm">{clientName} - {phoneNumber}</p>
      </div>
      <div className="mb-4">
        <h6 className="font-bold mb-3">Articles :</h6>
        <ul className="space-y-4">
          {order.items?.map((item, index) => (
            <OrderItem key={index} item={item} itemsData={itemsData} extraLists={extraLists} />
          )) || <li className="text-gray-500">Aucun article</li>}
        </ul>
      </div>
    </div>
  );
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

const Footer = () => (
  <footer className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg">
    <div className="grid grid-cols-4">
      {[
        { to: "/", icon: "fas fa-home", label: "Accueil" },
        { to: "/cart", icon: "fas fa-shopping-cart", label: "Panier" },
        { to: "/orders", icon: "fas fa-shopping-bag", label: "Commandes" },
        { to: "/account", icon: "fas fa-user", label: "Compte" },
      ].map(({ to, icon, label }) => (
        <Link key={to} to={to} className="text-gray-700 p-2 hover:text-green-600 transition-colors">
          <i className={`${icon} text-lg`}></i>
          <span className="block text-xs mt-1">{label}</span>
        </Link>
      ))}
    </div>
  </footer>
);

export default OrderStatus;