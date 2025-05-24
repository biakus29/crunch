import React, { useState, useEffect, useCallback } from "react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import {
  ORDER_STATUS,
  STATUS_LABELS,
  STATUS_COLORS,
  formatPrice,
  calculateOrderTotals,
} from "../utils/orderUtils"

const PendingOrdersModal = ({ orders, items, extraLists, usersData, onClose, onUpdateStatus }) => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [ignoreUntil, setIgnoreUntil] = useState(null);
  const [error, setError] = useState(null);

  // Filtrer les commandes en attente et initialiser leur priorité
  useEffect(() => {
    const filtered = orders
      .filter((order) => !order.status || order.status === ORDER_STATUS.PENDING)
      .map((order) => ({
        ...order,
        priority: order.priority || 0, // Priorité par défaut à 0 si non définie
      }))
      .sort((a, b) => b.priority - a.priority); // Trier par priorité décroissante
    setPendingOrders(filtered);
  }, [orders]);

  // Gestion du glisser-déposer
  const handleDragStart = (e, order) => {
    setDraggedOrder(order);
    e.dataTransfer.setData("text/plain", order.id);
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove("opacity-50");
    setDraggedOrder(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-gray-100");
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove("bg-gray-100");
  };

  const handleDrop = async (e, targetOrder) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-gray-100");
    if (!draggedOrder || draggedOrder.id === targetOrder.id) return;

    const newOrders = [...pendingOrders];
    const draggedIndex = newOrders.findIndex((o) => o.id === draggedOrder.id);
    const targetIndex = newOrders.findIndex((o) => o.id === targetOrder.id);

    // Réorganiser les commandes
    newOrders.splice(draggedIndex, 1);
    newOrders.splice(targetIndex, 0, draggedOrder);

    // Mettre à jour les priorités
    const updatedOrders = newOrders.map((order, index) => ({
      ...order,
      priority: newOrders.length - index, // Priorité décroissante
    }));

    setPendingOrders(updatedOrders);

    // Mettre à jour Firestore
    try {
      for (const order of updatedOrders) {
        const orderRef = doc(db, "orders", order.id);
        await updateDoc(orderRef, {
          priority: order.priority,
          updatedAt: Timestamp.now(),
        });
      }
    } catch (err) {
      console.error("Erreur lors de la mise à jour des priorités:", err);
      setError("Erreur lors de la mise à jour des priorités");
    }
  };

  // Ignorer la modale temporairement
  const handleIgnore = useCallback(() => {
    const ignoreUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
    setIgnoreUntil(ignoreUntil);
    onClose();
  }, [onClose]);

  // Afficher la modale automatiquement toutes les 5 minutes si des commandes sont en attente
  useEffect(() => {
    if (pendingOrders.length === 0 || ignoreUntil) return;

    const now = new Date();
    if (ignoreUntil && now < new Date(ignoreUntil)) return;

    const interval = setInterval(() => {
      if (pendingOrders.length > 0) {
        // La modale est déjà ouverte via onClose
      }
    }, 5 * 60 * 1000); // Toutes les 5 minutes

    return () => clearInterval(interval);
  }, [pendingOrders, ignoreUntil]);

  // Rendu d'une carte de commande
  const renderOrderCard = (order) => {
    const user = order.userId
      ? usersData.byId[order.userId]
      : order.contact?.phone && usersData.byPhone[order.contact.phone];
    const clientInfo = user
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Utilisateur inconnu"
      : order.contact?.name || "Client inconnu";
    const phoneNumber = user?.phone || order.address?.phone || order.contact?.phone || "Non spécifié";
    const address = order.address || {};
    const quartier = address.area || "Non spécifié";
    const deliveryFee = order.deliveryFee !== undefined ? Number(order.deliveryFee) : 1000;
    const { subtotal, totalWithDelivery } = calculateOrderTotals(order, extraLists, items);

    return (
      <div
        key={order.id}
        draggable
        onDragStart={(e) => handleDragStart(e, order)}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, order)}
        className="mb-3 p-3 bg-white rounded-lg shadow-md border border-gray-200 cursor-move hover:shadow-lg transition-shadow"
      >
        <div className="flex flex-col space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <div className="font-medium text-gray-800 truncate" title={clientInfo}>
              {clientInfo} <span className="ml-2 text-gray-600 text-xs">Tel: {phoneNumber}</span>
            </div>
            <span className="text-gray-600">Priorité: {order.priority}</span>
          </div>
          <div className="text-gray-600">Quartier: {quartier}</div>
          <div className="flex justify-between">
            <span>Total: {formatPrice(totalWithDelivery)} FCFA</span>
            <span>Frais: {formatPrice(deliveryFee)} FCFA</span>
          </div>
          <div className="flex justify-between">
            <button
              className="text-blue-600 hover:text-blue-800 text-sm"
              onClick={() => onUpdateStatus(order.id, ORDER_STATUS.PREPARING)}
            >
              Passer en préparation
            </button>
            <button
              className="text-red-600 hover:text-red-800 text-sm"
              onClick={() => onUpdateStatus(order.id, ORDER_STATUS.FAILED, "Annulation manuelle")}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">
          Commandes en attente ({pendingOrders.length})
        </h3>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        {pendingOrders.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Aucune commande en attente</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {pendingOrders.map(renderOrderCard)}
          </div>
        )}
        <div className="mt-4 flex gap-4">
          <button
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
            onClick={handleIgnore}
          >
            Ignorer (24h)
          </button>
          <button
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingOrdersModal;