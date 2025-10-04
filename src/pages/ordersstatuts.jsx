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
import { formatPrice } from "./oders";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, 
  Package, 
  Clock, 
  Star, 
  Check, 
  X, 
  Plus, 
  Minus, 
  ArrowLeft, 
  ArrowRight, 
  AlertCircle, 
  Info,
  Home,
  Heart,
  Settings,
  Bell,
  Edit,
  Save,
  Trash2,
  User,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Smartphone,
  DollarSign,
  Truck
} from 'lucide-react';

// ==================== Loaders Personnalisés ====================
const OrdersLoader = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center h-40"
  >
    <div className="relative">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 rounded-full border-4 border-green-400 border-t-transparent"
      ></motion.div>
      <motion.div 
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Package className="w-8 h-8 text-green-500" />
      </motion.div>
    </div>
    <motion.p 
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="mt-4 text-green-600 font-semibold"
    >
      Chargement des commandes...
    </motion.p>
  </motion.div>
);

// ==================== Indicateur de Progression ====================
const ProgressIndicator = ({ status }) => {
  const steps = [
    { key: ORDER_STATUS.PENDING, label: 'En attente', icon: <Clock className="w-4 h-4" />, color: 'bg-gray-400' },
    { key: ORDER_STATUS.PREPARING, label: 'En préparation', icon: <Package className="w-4 h-4" />, color: 'bg-blue-500' },
    { key: ORDER_STATUS.READY_TO_DELIVER, label: 'Prêt', icon: <Check className="w-4 h-4" />, color: 'bg-yellow-500' },
    { key: ORDER_STATUS.DELIVERING, label: 'En livraison', icon: <Truck className="w-4 h-4" />, color: 'bg-orange-500' },
    { key: ORDER_STATUS.DELIVERED, label: 'Livré', icon: <Star className="w-4 h-4" />, color: 'bg-green-500' }
  ];

  const statusOrder = [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY_TO_DELIVER, ORDER_STATUS.DELIVERING, ORDER_STATUS.DELIVERED];
  const currentIndex = statusOrder.indexOf(status);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={step.key} className="flex flex-col items-center flex-1 relative">
              <motion.div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isCompleted ? step.color + ' text-white' : 'bg-gray-200 text-gray-400'
                }`}
                animate={isCurrent ? { scale: [1, 1.2, 1] } : "false"}
                transition={{ duration: 0.5, repeat: isCurrent ? Infinity : 0, repeatDelay: 1 }}
                whileHover={{ scale: 1.1 }}
              >
                {isCompleted && !isCurrent && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Check className="w-3 h-3" />
                  </motion.div>
                )}
                {!isCompleted && step.icon}
                {isCurrent && step.icon}
              </motion.div>
              <motion.span 
                className={`text-xs mt-1 text-center ${
                  isCompleted ? 'text-gray-800 font-medium' : 'text-gray-500'
                }`}
                animate={isCurrent ? { color: '#1f2937' } : "false"}
              >
                {step.label}
              </motion.span>
              {index < steps.length - 1 && (
                <motion.div
                  className={`h-1 flex-1 mx-2 mt-2 rounded-full ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                  animate={isCompleted ? { scaleX: [0, 1] } : {}}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Fallback formatPrice function if import fails
const formatPriceFallback = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// Use imported formatPrice or fallback
const formatPriceToUse = formatPrice || formatPriceFallback;

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
  const navigate = useNavigate();

  const effectiveUserId = useMemo(
    () => currentUserId || localStorage.getItem("guestUid"),
    [currentUserId]
  );

  // Optimized auth effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  // Optimized data fetching
  const fetchReferenceData = useCallback(async () => {
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
  }, [setError]);

  // Optimized orders fetching
  useEffect(() => {
    setError("");

    if (!isAdmin && effectiveUserId === null) {
      setError("Vous devez être connecté pour voir vos commandes. Redirection vers la page de connexion...");
      setLoading(false);
      return;
    }

    if (!effectiveUserId && !isAdmin) {
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
          const newOrders = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              status: doc.data().status || ORDER_STATUS.PENDING,
            }))
            .filter((order) => order.items && Array.isArray(order.items) && order.items.length > 0)
            .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
          
          setOrders(newOrders);
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
  }, [isAdmin, effectiveUserId, navigate, fetchReferenceData]);

  // Optimized filtered orders
  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter((order) => order.status === activeTab);
  }, [orders, activeTab]);

  // Optimized status counts
  const statusCounts = useMemo(() => {
    if (!Array.isArray(orders)) return {};
    return Object.keys(STATUS_LABELS).reduce((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status).length;
      return acc;
    }, {});
  }, [orders]);

  // Optimized delivery fee calculation
  const getDeliveryFee = useCallback((area) => {
    if (!area) return DEFAULT_DELIVERY_FEE;
    const quartier = quartiersList.find((q) => q.name?.toLowerCase() === area?.toLowerCase());
    return quartier ? Number(quartier.fee) : DEFAULT_DELIVERY_FEE;
  }, [quartiersList]);

  // Optimized total calculation
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

  // Optimized drag and drop handlers
  const handleDragStart = useCallback((e, order) => {
    e.dataTransfer.setData("orderId", order.id);
    setDraggedOrder(order);
    e.currentTarget.style.opacity = "0.5";
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.style.opacity = "1";
    setDraggedOrder(null);
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
      setError("Impossible de mettre à jour le statut ou d'envoyer la notification");
    }
  }, [orders, isAdmin, itemsData, draggedOrder]);

  // Optimized delivery fees update
  const updateOrderDeliveryFees = useCallback(async (orderId, area, newFee) => {
    const feeNumber = Number(newFee);
    if (isNaN(feeNumber) || feeNumber < 0) {
      setError("Frais de livraison invalides.");
      return;
    }

    try {
      const orderRef = doc(db, "orders", orderId);
      if (isAdmin && !quartiersList.some((q) => q.name?.toLowerCase() === area?.toLowerCase())) {
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

  const renderTabs = () => (
    <div>
      {isAdmin && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Gestion des Commandes</h3>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-6 border-b" role="tablist">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <motion.button
            key={status}
            onClick={() => setActiveTab(status)}
            role="tab"
            aria-selected={activeTab === status}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
              activeTab === status
                ? `${STATUS_COLORS[status]} border-b-2 border-white`
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {label} ({statusCounts[status] || 0})
          </motion.button>
        ))}
      </div>
      
      {/* Zones de drop pour les admins */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <motion.div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, status)}
              className={`p-4 rounded-lg border-2 border-dashed ${
                draggedOrder && draggedOrder.status !== status
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="text-center">
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${STATUS_COLORS[status]}`}>
                  {status === ORDER_STATUS.PENDING && <Clock className="w-4 h-4" />}
                  {status === ORDER_STATUS.PREPARING && <Package className="w-4 h-4" />}
                  {status === ORDER_STATUS.READY_TO_DELIVER && <Check className="w-4 h-4" />}
                  {status === ORDER_STATUS.DELIVERING && <Truck className="w-4 h-4" />}
                  {status === ORDER_STATUS.DELIVERED && <Star className="w-4 h-4" />}
                </div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-gray-500">{statusCounts[status] || 0} commande(s)</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      
      <div className="max-w-5xl mx-auto">
        {filteredOrders.length === 0 ? (
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-gray-500 py-10"
          >
            Aucune commande dans cet état
          </motion.p>
        ) : (
          <AnimatePresence>
            {filteredOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
              >
                <OrderCard
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
                  onDragStart={(e) => handleDragStart(e, order)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, order.status)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <OrdersLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white border-b p-4 shadow-sm">
        <h2 className="text-center font-bold text-2xl">
          {isAdmin ? "Tableau de bord des commandes" : "Mes commandes"}
        </h2>
      </header>
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
      {!loading && orders.length > 0 && (
        <div className="flex justify-between items-center mb-8">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-bold text-gray-800"
          >
            {isAdmin ? "Gestion des commandes" : "Suivi de vos commandes"}
          </motion.h1>
        </div>
      )}

        {/* Notification pour les commandes en livraison */}
        {!isAdmin && orders.some(order => order.status === ORDER_STATUS.DELIVERING) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <Truck className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">Commande en cours de livraison</h3>
                <p className="text-sm text-green-600">
                  Vous avez {orders.filter(order => order.status === ORDER_STATUS.DELIVERING).length} commande(s) en livraison. 
                  N'oubliez pas de confirmer la réception une fois livrée !
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Notification pour les admins */}
        {isAdmin && orders.some(order => order.status === ORDER_STATUS.READY_TO_DELIVER) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-800">Commandes prêtes à livrer</h3>
                <p className="text-sm text-blue-600">
                  Vous avez {orders.filter(order => order.status === ORDER_STATUS.READY_TO_DELIVER).length} commande(s) prête(s) à être livrée(s).
                </p>
              </div>
            </div>
          </motion.div>
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

const OrderCard = React.memo(({
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
  const [showDetails, setShowDetails] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const navigate = useNavigate();

  const user = useMemo(() => 
    order.userId
      ? usersData.byId[order.userId]
      : order.contact?.phone && usersData.byPhone[order.contact.phone],
    [order.userId, order.contact?.phone, usersData]
  );

  const clientName = useMemo(() => 
    user
      ? `${user.lastName || ""} ${user.firstName || ""} ${user.email || ""}`.trim() ||
        "Utilisateur inconnu"
      : order.contact?.name || "Client inconnu",
    [user, order.contact?.name]
  );

  const phoneNumber = useMemo(() => 
    user?.phone || order.address?.phone || order.contact?.phone || "Non fourni",
    [user?.phone, order.address?.phone, order.contact?.phone]
  );

  const handleConfirmDelivery = useCallback(async () => {
    setIsUpdating(true);
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
    } finally {
      setIsUpdating(false);
    }
  }, [order.id, order.items, calculateTotal, navigate]);

  const handleShowDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);

  const handleShowModal = useCallback(() => {
    setShowConfirmModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -5, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden"
      draggable={isAdmin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">Commande #{order.id.slice(-8)}</h3>
            <p className="text-sm text-gray-500">{formatDate(order.timestamp)}</p>
          </div>
          <motion.span
            className={`px-3 py-1 rounded-full text-xs font-medium ${badgeClasses[order.status]}`}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            {STATUS_LABELS[order.status] || "En attente"}
          </motion.span>
        </div>

        {/* Indicateur de progression amélioré */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-50 rounded-lg p-3 mb-4"
        >
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Package className="w-4 h-4 mr-1" />
            Progression de votre commande
          </h4>
          <ProgressIndicator status={order.status} />
        </motion.div>

        <div className="space-y-2 mb-3">
          {order.items.map((item, index) => (
            <OrderItem
              key={`${item.dishId}-${index}`}
              item={item}
              itemsData={itemsData}
              extraLists={extraLists}
            />
          ))}
        </div>

        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-gray-800">
                Total: {formatPriceToUse(calculateTotal(order))} Fcfa
              </p>
              {deliveryFee > 0 && (
                <p className="text-sm text-gray-500">
                  Livraison: {formatPriceToUse(deliveryFee)} Fcfa
                </p>
              )}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShowDetails}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {showDetails ? "Masquer" : "Détails"}
            </motion.button>
          </div>
        </div>

        {/* Bouton de confirmation de livraison - Simple et visible */}
        {!isAdmin && order.status === ORDER_STATUS.DELIVERING && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleShowModal}
            className="w-full mt-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-lg"
          >
            ✅ Confirmer la livraison
          </motion.button>
        )}

        {/* Bouton pour les admins - Simple et visible */}
        {isAdmin && order.status === ORDER_STATUS.READY_TO_DELIVER && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConfirmDelivery}
            disabled={isUpdating}
            className="w-full mt-3 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
          >
            {isUpdating ? "⏳ Confirmation..." : "🚚 Confirmer la livraison"}
          </motion.button>
        )}

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t pt-3 mt-3"
            >
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Client:</span>
                  <span className="font-medium">{clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Téléphone:</span>
                  <span className="font-medium">{phoneNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Adresse:</span>
                  <span className="font-medium text-right">
                    {order.address?.area || "Non spécifiée"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Paiement:</span>
                  <span className="font-medium">{order.paymentMethod?.name || "Non spécifié"}</span>
                </div>
                {order.pointsUsed > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Points utilisés:</span>
                    <span className="font-medium">{order.pointsUsed} points</span>
                  </div>
                )}
                {order.loyaltyPoints > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Points gagnés:</span>
                    <span className="font-medium">{order.loyaltyPoints} points</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal de confirmation de livraison */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg w-full max-w-md p-6"
            >
              <h5 className="font-semibold mb-4 text-center">Confirmer la réception</h5>
              <p className="text-sm text-gray-600 mb-6 text-center">
                Avez-vous bien reçu votre commande <strong>#{order.id.slice(-8)}</strong> ?
              </p>
              
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCloseModal}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  Annuler
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirmDelivery}
                  disabled={isUpdating}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {isUpdating ? "Confirmation..." : "Oui, confirmer"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {paymentError && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-600 text-sm mt-2 text-center"
          role="alert"
        >
          {paymentError}
        </motion.p>
      )}
    </motion.div>
  );
});

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

const OrderItem = React.memo(({ item, itemsData, extraLists }) => {
  const itemPrice = useMemo(() => 
    Number(item.dishPrice || itemsData[item.dishId]?.price || 0),
    [item.dishPrice, itemsData, item.dishId]
  );
  
  const quantity = useMemo(() => 
    Number(item.quantity || 1),
    [item.quantity]
  );
  
  const extrasTotal = useMemo(() => 
    item.selectedExtras
      ? Object.entries(item.selectedExtras).reduce((sum, [extraListId, indexes]) => {
          const extraList = extraLists[extraListId]?.extraListElements || [];
          return sum + indexes.reduce((acc, index) => acc + Number(extraList[index]?.price || 0), 0);
        }, 0)
      : 0,
    [item.selectedExtras, extraLists]
  );

  const itemName = useMemo(() => 
    item.dishName || itemsData[item.dishId]?.name || "Article inconnu",
    [item.dishName, itemsData, item.dishId]
  );

  return (
    <li className="pb-2 border-b border-gray-100">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">{itemName}</p>
          <p className="text-sm text-gray-500">Quantité : {quantity}</p>
        </div>
        <p className="text-sm text-green-600">+{formatPriceToUse((itemPrice + extrasTotal) * quantity)} FCFA</p>
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
                          +{formatPriceToUse(extra.price * quantity)} FCFA
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
});

OrderItem.propTypes = {
  item: PropTypes.object.isRequired,
  itemsData: PropTypes.object,
  extraLists: PropTypes.object,
};

const Footer = () => (
  <footer className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg">
    <div className="grid grid-cols-4">
      {[
        { to: "/accueil", icon: <Home className="w-5 h-5" />, label: "Accueil" },
        { to: "/cart", icon: <ShoppingCart className="w-5 h-5" />, label: "Panier" },
        { to: "/complete_order", icon: <Package className="w-5 h-5" />, label: "Commandes" },
        { to: "/profile", icon: <User className="w-5 h-5" />, label: "Compte" },
      ].map(({ to, icon, label }) => (
        <Link key={to} to={to} className="text-gray-700 p-2 hover:text-green-600 transition-colors">
          <div className="flex justify-center">
            {icon}
          </div>
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
      // Récupérer l'ID du restaurant depuis la commande
      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      const restaurantId = orderSnap.exists() ? orderSnap.data().restaurantId : null;

      const feedbackRef = doc(collection(db, "feedback"));
      await setDoc(feedbackRef, {
        orderId,
        userId: localStorage.getItem("guestUid") || null,
        restaurantId,
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
                Vous avez utilisé {formatPriceToUse(pointsUsed)} points pour une réduction de {formatPriceToUse(pointsReduction)} FCFA.
              </p>
            )}
            {loyaltyPoints > 0 && (
              <p className="text-sm text-gray-600">
                Vous avez gagné {formatPriceToUse(loyaltyPoints)} points pour cette commande (crédités après validation).
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