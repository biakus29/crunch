import { useEffect, useMemo, useState, useCallback } from "react";
import { db, auth } from "../../firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { Timestamp, deleteDoc } from "firebase/firestore";
import { ORDER_STATUS } from "../../components/admin/adminConstants";
import { calculateOrderTotals } from "../../utils/adminUtils";

/**
 * useOrdersAdmin
 * Centralise la gestion des commandes pour l'admin restaurant.
 *
 * Entrées:
 * - currentRestaurantId: string
 * - extraLists: array (pour le calcul des totaux)
 * - items: array (pour les filtres/affichages optionnels)
 *
 * Sorties:
 * - orders, loadingOrders, ordersError
 * - pendingOrders, filteredOrders, selectedDate, setSelectedDate, dateFilterMode, setDateFilterMode
 * - actions: updateOrderStatus, updateOrderDeliveryFees, deleteOrder
 */
export function useOrdersAdmin({ currentRestaurantId, extraLists = [], items = [] }) {
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateFilterMode, setDateFilterMode] = useState("day"); // 'day' | 'week' | 'month'

  // Subscribe to all orders (can be optimized later by restaurant filter if present in schema)
  useEffect(() => {
    const ordersQuery = query(collection(db, "orders"));
    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const allOrders = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          status: d.data().status || ORDER_STATUS.PENDING,
        }));
        setOrders(allOrders);
        setLoadingOrders(false);
      },
      (err) => {
        console.error("Erreur dans l'écoute des commandes:", err);
        setOrdersError("Erreur dans le suivi des commandes");
        setLoadingOrders(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const formatDateForComparison = (date) => date.toISOString().split("T")[0];

  const filterOrdersByDate = useCallback((ordersList, date, mode) => {
    const selected = new Date(date);
    return ordersList.filter((order) => {
      if (!order.timestamp) return false;
      const orderDate = new Date(order.timestamp.seconds * 1000);
      switch (mode) {
        case "day":
          return formatDateForComparison(orderDate) === formatDateForComparison(selected);
        case "week": {
          const startOfWeek = new Date(selected);
          startOfWeek.setDate(selected.getDate() - selected.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return orderDate >= startOfWeek && orderDate <= endOfWeek;
        }
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

  const pendingOrders = useMemo(() => {
    return orders.filter((o) => o && o.id && o.status === ORDER_STATUS.PENDING);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!items.length) return [];
    const dateFiltered = filterOrdersByDate(orders, selectedDate, dateFilterMode);
    return dateFiltered.filter((order) =>
      order.items?.some((item) => items.some((it) => it.id === item.dishId))
    );
  }, [orders, items, selectedDate, dateFilterMode, filterOrdersByDate]);

  const updateOrderDeliveryFees = useCallback(async (orderId, destination, newFee, deliveryFees = {}) => {
    const feeNumber = Number(newFee);
    if (isNaN(feeNumber) || feeNumber < 0) return;
    try {
      const orderRef = doc(db, "orders", orderId);
      if (deliveryFees[destination] === undefined) {
        await setDoc(doc(db, "quartiers", destination), {
          fee: feeNumber,
          name: destination,
        });
      }
      await updateDoc(orderRef, {
        deliveryFee: feeNumber,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Erreur de mise à jour des frais:", error);
      throw error;
    }
  }, []);

  const updateOrderStatus = useCallback(
    async (orderId, status, reason = null, isPaid = false) => {
      try {
        if (!orderId || !auth.currentUser) {
          throw new Error("Informations manquantes pour mettre à jour le statut.");
        }
        const orderRef = doc(db, "orders", orderId);
        const statusHistoryRef = collection(orderRef, "statusHistory");
        const notificationsRef = collection(db, "notifications");
        const statusData = { status, timestamp: Timestamp.now() };
        if (reason) statusData.reason = reason;

        await addDoc(statusHistoryRef, statusData);
        await updateDoc(orderRef, { status, isPaid, updatedAt: Timestamp.now() });

        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) throw new Error("La commande n'existe pas.");
        const orderData = orderSnap.data();
        const { totalWithDelivery } = calculateOrderTotals(orderData, extraLists);

        if (status === ORDER_STATUS.DELIVERED && window.fbq) {
          window.fbq("track", "Purchase", {
            value: totalWithDelivery,
            currency: "XAF",
            content_ids: orderData.items.map((it) => it.dishId),
            content_type: "product",
            order_id: orderId,
            restaurant_id: orderData.restaurantId || currentRestaurantId,
          });
        }

        const notificationData = {
          orderId,
          oldStatus: orderData.status || ORDER_STATUS.PENDING,
          newStatus: status,
          timestamp: Timestamp.now(),
          userId: orderData.userId || "unknown",
          restaurantId: orderData.restaurantId || currentRestaurantId,
          read: false,
        };
        await addDoc(notificationsRef, notificationData);
      } catch (error) {
        console.error(
          "Erreur lors de la mise à jour du statut ou création de la notification:",
          error
        );
        throw error;
      }
    },
    [currentRestaurantId, extraLists]
  );

  const deleteOrder = useCallback(async (orderId) => {
    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch (error) {
      console.error("Erreur lors de la suppression de la commande:", error);
      throw error;
    }
  }, []);

  return {
    // state
    orders,
    loadingOrders,
    ordersError,

    // date filters
    pendingOrders,
    filteredOrders,
    selectedDate,
    setSelectedDate,
    dateFilterMode,
    setDateFilterMode,

    // actions
    updateOrderStatus,
    updateOrderDeliveryFees,
    deleteOrder,
  };
}
