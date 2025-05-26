import React, { useEffect, useState, useMemo, useCallback } from "react";
import { db, auth, storage } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  onSnapshot,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import LoyaltyPointsManager from "./LoyaltyPoints"; // Import du composant

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

const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const convertPrice = (price) => {
  if (typeof price === "string") {
    return parseFloat(price.replace(/\./g, ""));
  }
  return Number(price);
};

const calculateTimeDifferenceInMinutes = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate - startDate;
  return Math.floor(diffMs / (1000 * 60));
};

const calculateOrderTotals = (order, extraLists, items) => {
  console.log("Calcul des totaux pour la commande:", order.id, { items: order.items, pointsUsed: order.pointsUsed, pointsReduction: order.pointsReduction });
  const subtotal = order.items.reduce((sum, item) => {
    const currentItem = Array.isArray(items) ? items.find((it) => it.id === item.dishId) : null;
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
  console.log("Résultat des totaux:", { subtotal, deliveryFee, pointsReduction, totalWithDelivery });
  return { subtotal, totalWithDelivery, pointsReduction };
};
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

const OrderCard = ({ order, items, extraLists, usersData, onShowDetails, onDragStart, onDragEnd }) => {
  console.log("Rendu d'OrderCard pour la commande:", order.id, { status: order.status, items: order.items });
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
    return element ? `${element.name}${element.price ? ` (+${convertPrice(element.price).toLocaleString()} FCFA)` : ""}` : "Extra inconnu";
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
        {/* Infos Client */}
        <div className="font-medium text-gray-800 truncate" title={clientInfo}>
          Client: {clientInfo}
          <span className="ml-2 text-gray-600 text-sm">Tel: {phoneNumber}</span>
        </div>
        <div className="text-gray-600">Quartier: {quartier}</div>
        <div className="text-gray-600">Adresse: {description}</div>
        <div className="text-gray-600">Frais de livraison: {formatPrice(deliveryFee)} FCFA</div>

        {/* ID et Statut */}
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

        {/* Articles */}
        <div className="border-t pt-2">
          <h4 className="font-semibold text-sm mb-1">Articles:</h4>
          <div className="max-h-32 overflow-y-auto text-sm">
            {order.items.map((item, index) => {
              const currentItem = Array.isArray(items) ? items.find((it) => it.id === item.dishId) : null;
              console.log(`Article ${item.dishId}:`, { price: item.price, dishPrice: item.dishPrice, currentItemPrice: currentItem?.price });
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
                    <span>{price.toLocaleString()} FCFA × {item.quantity}</span>
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

        {/* Résumé */}
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
            <span>Prix reduit:</span>
            <span className="text-red-600">
        {formatPrice(Number(order.pointsReduction) || 0)} FCFA
        </span>
          </div>
          <div className="flex justify-between text-green-600 font-semibold">
            <span>Total:</span>
            <span>{formatPrice(totalWithDelivery)} FCFA</span>
          </div>
        </div>

        {/* Statut de paiement */}
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
                const newPaidStatus = e.target.checked;
                try {
                  const orderRef = doc(db, "orders", order.id);
                  await updateDoc(orderRef, {
                    isPaid: newPaidStatus,
                    updatedAt: Timestamp.now(),
                  });
                } catch (error) {
                  console.error("Erreur lors de la mise à jour du statut payé:", error);
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
    Points utilisés: {(Number(order.pointsUsed) || 0) > 0 ? (
      <>
        ✅ {order.pointsUsed}{" "}
        
      </>
    ) : "-"}
  </span>
</div>
      </div>
    </div>
  );
};
const OrderDetailsModal = React.memo(({ order, items, extraLists, usersData, onClose, onUpdateFees, onDelete, onUpdateStatus }) => {
  const user = order.userId
    ? usersData.byId[order.userId]
    : order.contact?.phone && usersData.byPhone[order.contact.phone];
  const clientInfo = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Utilisateur inconnu"
    : order.contact?.name || "Client inconnu";
  const restaurantEmail = usersData.byId[order.restaurantId]?.email || "Restaurant inconnu";
  const phoneNumber = user?.phone || order.address?.phone || order.contact?.phone || "Non spécifié";
  const addressDescription = order.address?.completeAddress || order.destination || "Non spécifiée";
  const additionalAddressInfo = order.address?.instructions || "";
  const orderDate = order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleString("fr-FR") : "Date inconnue";
  const [newStatus, setNewStatus] = useState(order.status || ORDER_STATUS.PENDING);
  const [failureReason, setFailureReason] = useState("");
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [isPaid, setIsPaid] = useState(order.isPaid || false);
  const [statusHistory, setStatusHistory] = useState([]);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editedItems, setEditedItems] = useState(order.items.map(item => ({ ...item })));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [newFee, setNewFee] = useState(order.deliveryFee !== undefined ? order.deliveryFee : DEFAULT_DELIVERY_FEE);
  const [isSavingFees, setIsSavingFees] = useState(false);
  const [feeError, setFeeError] = useState(null);
  const [feeSuccessMessage, setFeeSuccessMessage] = useState(null);

  const getExtraName = useCallback((extraListId, index) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    const element = extraList?.extraListElements?.[index];
    return element ? `${element.name}${element.price ? ` (+${convertPrice(element.price).toLocaleString()} FCFA)` : ""}` : "Extra inconnu";
  }, [extraLists]);

  const getItemPrice = useCallback((item) => {
    return item.price !== undefined && !isNaN(convertPrice(item.price))
      ? convertPrice(item.price)
      : item.dishPrice !== undefined && !isNaN(convertPrice(item.dishPrice))
      ? convertPrice(item.dishPrice)
      : items.find((it) => it.id === item.dishId)?.price
      ? convertPrice(items.find((it) => it.id === item.dishId).price)
      : 0;
  }, [items]);

  const { subtotal, totalWithDelivery } = useMemo(() => {
    if (!editedItems || !extraLists) {
      console.warn("Données manquantes pour OrderDetailsModal:", { editedItems, extraLists });
      return { subtotal: 0, totalWithDelivery: order.deliveryFee ?? DEFAULT_DELIVERY_FEE };
    }
    return calculateOrderTotals({ ...order, items: editedItems }, extraLists, items);
  }, [order, editedItems, extraLists, items]);

  useEffect(() => {
    const statusHistoryQuery = query(collection(db, "orders", order.id, "statusHistory"));
    const unsubscribe = onSnapshot(statusHistoryQuery, (snapshot) => {
      const history = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setStatusHistory(history);
      if (history.length > 0) {
        setNewStatus(history[history.length - 1].status);
      }
    }, (error) => {
      console.error("Erreur lors de la récupération de l'historique des statuts:", error);
    });
    return () => unsubscribe();
  }, [order.id]);

  const handleTogglePaid = async () => {
    const newPaidStatus = !isPaid;
    setIsPaid(newPaidStatus);
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, { isPaid: newPaidStatus, updatedAt: Timestamp.now() });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut payé:", error);
      setIsPaid(!newPaidStatus);
      setError("Erreur lors de la mise à jour du statut payé");
    }
  };

  const handleEditItems = () => {
    setIsEditingItems(true);
    setEditedItems(order.items.map(item => ({ ...item })));
    setError(null);
    setSuccessMessage(null);
  };

  const handleChangeItem = (index, newDishId) => {
    const newItem = items.find(it => it.id === newDishId);
    if (!newItem) return;
    setEditedItems(prev => {
      const updatedItems = [...prev];
      updatedItems[index] = {
        dishId: newItem.id,
        dishName: newItem.name,
        price: newItem.price,
        quantity: updatedItems[index].quantity,
        selectedExtras: {}, // Réinitialiser les extras pour éviter les incohérences
        covers: newItem.covers || updatedItems[index].covers,
      };
      return updatedItems;
    });
  };

  const handleQuantityChange = (index, delta) => {
    setEditedItems(prev => {
      const updatedItems = [...prev];
      const currentItem = items.find(it => it.id === updatedItems[index].dishId);
      const maxQuantity = currentItem?.quantityleft || Number.MAX_SAFE_INTEGER;
      const newQuantity = Math.max(1, Math.min(maxQuantity, updatedItems[index].quantity + delta));
      updatedItems[index] = { ...updatedItems[index], quantity: newQuantity };
      return updatedItems;
    });
  };

  const handleExtraChange = (index, extraListId, selectedIndexes) => {
    setEditedItems(prev => {
      const updatedItems = [...prev];
      const extraList = extraLists.find(el => el.id === extraListId);
      if (!extraList) return updatedItems;
      const isRequired = extraList.extraListElements.some(el => el.required);
      const isMultiple = extraList.extraListElements.some(el => el.multiple);
      if (isRequired && selectedIndexes.length === 0) return updatedItems;
      if (!isMultiple && selectedIndexes.length > 1) return updatedItems;
      updatedItems[index] = {
        ...updatedItems[index],
        selectedExtras: {
          ...updatedItems[index].selectedExtras,
          [extraListId]: selectedIndexes,
        },
      };
      return updatedItems;
    });
  };

  const handleAddExtraList = (index, extraListId) => {
    setEditedItems(prev => {
      const updatedItems = [...prev];
      updatedItems[index] = {
        ...updatedItems[index],
        selectedExtras: {
          ...updatedItems[index].selectedExtras,
          [extraListId]: [],
        },
      };
      return updatedItems;
    });
  };

  const handleRemoveExtraList = (index, extraListId) => {
    setEditedItems(prev => {
      const updatedItems = [...prev];
      const { [extraListId]: _, ...rest } = updatedItems[index].selectedExtras || {};
      updatedItems[index] = {
        ...updatedItems[index],
        selectedExtras: rest,
      };
      return updatedItems;
    });
  };

  const handleAddItem = (dishId) => {
    const item = items.find(it => it.id === dishId);
    if (!item) return;
    setEditedItems(prev => [
      ...prev,
      {
        dishId,
        dishName: item.name,
        price: item.price,
        quantity: 1,
        selectedExtras: {},
        covers: item.covers,
      },
    ]);
  };

  const handleDeleteItem = (index) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cet article ?")) return;
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  const validateItems = () => {
    for (const item of editedItems) {
      const currentItem = items.find(it => it.id === item.dishId);
      if (!currentItem) return "Article introuvable dans le catalogue";
      if (item.quantity < 1) return "La quantité doit être d'au moins 1";
      if (currentItem.quantityleft && item.quantity > currentItem.quantityleft) {
        return `Quantité dépasse le stock disponible pour ${currentItem.name}`;
      }
      if (currentItem.available === false) {
        return `L'article ${currentItem.name} n'est pas disponible`;
      }
      if (item.selectedExtras) {
        for (const [extraListId, indexes] of Object.entries(item.selectedExtras)) {
          const extraList = extraLists.find(el => el.id === extraListId);
          if (!extraList) return "Liste d'extras introuvable";
          const isRequired = extraList.extraListElements.some(el => el.required);
          const isMultiple = extraList.extraListElements.some(el => el.multiple);
          if (isRequired && (!indexes || indexes.length === 0)) {
            return `Extras obligatoires manquants pour ${extraList.name}`;
          }
          if (!isMultiple && indexes.length > 1) {
            return `Un seul extra peut être sélectionné pour ${extraList.name}`;
          }
        }
      }
    }
    return null;
  };

  const handleSaveItems = async () => {
    const validationError = validateItems();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        items: editedItems,
        updatedAt: Timestamp.now(),
      });
      setSuccessMessage("Articles mis à jour avec succès");
      setIsEditingItems(false);
    } catch (error) {
      console.error("Erreur lors de la mise à jour des articles:", error);
      setError("Erreur lors de la sauvegarde des articles");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingItems(false);
    setEditedItems(order.items.map(item => ({ ...item })));
    setError(null);
    setSuccessMessage(null);
  };

  const handleStatusChange = async () => {
    if (newStatus === ORDER_STATUS.FAILED) {
      setShowFailureModal(true);
    } else {
      await onUpdateStatus(order.id, newStatus, null, isPaid);
      onClose();
    }
  };

  const handleFailureSubmit = async () => {
    if (failureReason) {
      await onUpdateStatus(order.id, ORDER_STATUS.FAILED, failureReason, isPaid);
      setShowFailureModal(false);
      onClose();
    }
  };

  const handleOpenFeeModal = useCallback(() => {
    setShowFeeModal(true);
    setNewFee(order.deliveryFee !== undefined ? order.deliveryFee : DEFAULT_DELIVERY_FEE);
    setFeeError(null);
    setFeeSuccessMessage(null);
  }, [order.deliveryFee]);

  const handleFeeChange = useCallback((delta) => {
    setNewFee(prev => Math.max(0, prev + delta));
    setFeeError(null);
  }, []);

  const validateFee = useCallback(() => {
    if (isNaN(newFee) || newFee < 0) return "Les frais doivent être un nombre positif";
    if (newFee === (order.deliveryFee !== undefined ? order.deliveryFee : DEFAULT_DELIVERY_FEE)) return "Aucune modification détectée";
    return null;
  }, [newFee, order.deliveryFee]);

  const handleSaveFees = async () => {
    const validationError = validateFee();
    if (validationError) {
      setFeeError(validationError);
      return;
    }
    setIsSavingFees(true);
    setFeeError(null);
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        deliveryFee: Number(newFee),
        updatedAt: Timestamp.now(),
      });
      await onUpdateFees(order.id, order.address?.area || "inconnu", Number(newFee));
      setFeeSuccessMessage("Frais mis à jour avec succès");
      setTimeout(() => setShowFeeModal(false), 1000);
    } catch (error) {
      console.error("Erreur lors de la mise à jour des frais:", error);
      setFeeError("Erreur lors de la sauvegarde des frais");
    } finally {
      setIsSavingFees(false);
    }
  };

  const handleCancelFeeEdit = () => {
    setShowFeeModal(false);
    setNewFee(order.deliveryFee !== undefined ? order.deliveryFee : DEFAULT_DELIVERY_FEE);
    setFeeError(null);
    setFeeSuccessMessage(null);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl">
        <div className="sticky top-0 bg-white p-3 border-b flex justify-between items-center z-10">
          <h3 className="text-base font-semibold">Commande #{order.id.slice(0, 6)}</h3>
          <div className="flex items-center space-x-1">
            <span className="text-xs font-medium">{isPaid ? "Payé" : "Non payé"}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isPaid} onChange={handleTogglePaid} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>
        <div className="flex flex-col md:flex-row p-3 gap-3">
          <div className="md:w-1/2 space-y-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <h6 className="font-bold text-xs text-gray-800 mb-1">Client & Livraison</h6>
              <div className="text-xs text-gray-700 space-y-0.5">
                <p><span className="font-medium">Client :</span> {clientInfo}</p>
                <p><span className="font-medium">Tel :</span> {phoneNumber}</p>
                <p><span className="font-medium">Adresse :</span> {addressDescription}</p>
                {additionalAddressInfo && <p><span className="font-medium">Instr. :</span> {additionalAddressInfo}</p>}
                <p><span className="font-medium">Date :</span> {orderDate}</p>
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg">
              <h6 className="font-bold text-xs text-gray-800 mb-1">Paiement & Restaurant</h6>
              <div className="text-xs text-gray-700 space-y-0.5">
                <div className="flex items-center">
                  <i className={`${order.paymentMethod?.icon || "fa fa-credit-card"} text-green-600 text-sm mr-1`}></i>
                  <span>{order.paymentMethod?.name || "Non spécifié"}</span>
                </div>
                <p><span className="font-medium">Restaurant :</span> {restaurantEmail}</p>
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg">
              <h6 className="font-bold text-xs text-gray-800 mb-1">Historique</h6>
              {statusHistory.length > 0 ? (
                <div className="text-xs text-gray-700 space-y-1 max-h-40 overflow-y-auto">
                  {statusHistory.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex justify-between items-center p-1 border-b border-gray-200 ${
                        index === statusHistory.length - 1 ? "bg-gray-100" : ""
                      }`}
                    >
                      <span>
                        {index + 1}.{" "}
                        <span className={`px-1 rounded ${STATUS_COLORS[entry.status]}`}>
                          {STATUS_LABELS[entry.status] || entry.status}
                        </span>
                        {entry.reason && <span className="text-red-600"> ({entry.reason})</span>}
                        {index > 0 && (
                          <span className="text-green-600 ml-1">
                            (+{calculateTimeDifferenceInMinutes(statusHistory[index - 1].timestamp, entry.timestamp)} min)
                          </span>
                        )}
                      </span>
                      <span className="text-gray-500">
                        {entry.timestamp.toLocaleString("fr-FR")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Aucun historique</p>
              )}
            </div>
          </div>
          <div className="md:w-1/2 space-y-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <h6 className="font-bold text-xs text-gray-800">Articles</h6>
                {!isEditingItems && (
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={handleEditItems}
                  >
                    Modifier
                  </button>
                )}
              </div>
              {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
              {successMessage && <p className="text-green-600 text-xs mb-2">{successMessage}</p>}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {editedItems.map((item, index) => {
                  const currentItem = items.find((it) => it.id === item.dishId);
                  const price = getItemPrice(item);
                  return (
                    <div key={`${item.dishId}-${index}`} className="flex items-start">
                      <img
                        src={currentItem?.covers?.[0] || item.covers?.[0] || "/img/default.png"}
                        alt={item.dishName || currentItem?.name || "Plat inconnu"}
                        className="w-10 h-10 object-cover rounded mr-2"
                        onError={(e) => (e.target.src = "/img/default.png")}
                      />
                      <div className="flex-1 space-y-1">
                        {isEditingItems ? (
                          <>
                            <select
                              className="w-full border rounded text-xs p-1"
                              value={item.dishId}
                              onChange={(e) => handleChangeItem(index, e.target.value)}
                            >
                              {items.filter(it => it.available !== false).map(it => (
                                <option key={it.id} value={it.id}>
                                  {it.name} ({convertPrice(it.price).toLocaleString()} FCFA)
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center border rounded">
                              <button
                                className="px-2 py-1 text-xs"
                                onClick={() => handleQuantityChange(index, -1)}
                                disabled={item.quantity <= 1}
                              >
                                -
                              </button>
                              <span className="px-2 text-xs">{item.quantity}</span>
                              <button
                                className="px-2 py-1 text-xs"
                                onClick={() => handleQuantityChange(index, 1)}
                                disabled={currentItem?.quantityleft && item.quantity >= currentItem.quantityleft}
                              >
                                +
                              </button>
                            </div>
                            <div className="text-[10px] text-gray-600">
                              {item.selectedExtras && Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
                                <div key={extraListId} className="mb-1">
                                  <div className="flex justify-between">
                                    <span className="font-medium">{extraLists.find((el) => el.id === extraListId)?.name || "Extras"} :</span>
                                    <button
                                      className="text-red-600 text-xs hover:text-red-800"
                                      onClick={() => handleRemoveExtraList(index, extraListId)}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                  <select
                                    multiple={extraLists.find(el => el.id === extraListId)?.extraListElements.some(el => el.multiple)}
                                    value={indexes}
                                    onChange={(e) => handleExtraChange(index, extraListId, Array.from(e.target.selectedOptions, option => parseInt(option.value)))}
                                    className="w-full border rounded text-xs p-1"
                                  >
                                    {extraLists.find(el => el.id === extraListId)?.extraListElements.map((el, i) => (
                                      <option key={i} value={i}>{getExtraName(extraListId, i)}</option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                              <select
                                className="w-full border rounded text-xs p-1 mt-1"
                                onChange={(e) => handleAddExtraList(index, e.target.value)}
                                value=""
                              >
                                <option value="">Ajouter une liste d'extras</option>
                                {extraLists
                                  .filter(el => !Object.keys(item.selectedExtras || {}).includes(el.id))
                                  .map(el => (
                                    <option key={el.id} value={el.id}>{el.name}</option>
                                  ))}
                              </select>
                            </div>
                            <button
                              className="text-red-600 text-xs hover:text-red-800"
                              onClick={() => handleDeleteItem(index)}
                            >
                              Supprimer l'article
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-xs">{item.dishName || currentItem?.name || "Plat inconnu"}</p>
                              <p className="text-green-600 text-xs">
                                {price.toLocaleString()} FCFA × {item.quantity}
                              </p>
                            </div>
                            {item.selectedExtras && (
                              <div className="text-[10px] text-gray-600 mt-0.5">
                                {Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
                                  <p key={extraListId}>
                                    <span className="font-medium">{extraLists.find((el) => el.id === extraListId)?.name || "Extras"} :</span>{" "}
                                    {indexes.map((index) => getExtraName(extraListId, index)).join(", ")}
                                  </p>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isEditingItems && (
                <>
                  <div className="mt-2">
                    <select
                      className="w-full border rounded text-xs p-1"
                      onChange={(e) => handleAddItem(e.target.value)}
                      value=""
                    >
                      <option value="">Ajouter un article</option>
                      {items.filter(item => item.available !== false).map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({convertPrice(item.price).toLocaleString()} FCFA)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      className="flex-1 bg-blue-600 text-white p-1 rounded hover:bg-blue-700 text-xs disabled:bg-blue-300"
                      onClick={handleSaveItems}
                      disabled={isSaving}
                    >
                      {isSaving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button
                      className="flex-1 bg-gray-200 p-1 rounded hover:bg-gray-300 text-xs"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      Annuler
                    </button>
                  </div>
                </>
              )}
            </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <h6 className="font-bold text-xs text-gray-800 mb-1">Résumé</h6>
                <div className="text-xs text-gray-700 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Sous-total :</span>
                    <span>{formatPrice(subtotal)} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frais :</span>
                    <span>{formatPrice(order.deliveryFee !== undefined ? order.deliveryFee : DEFAULT_DELIVERY_FEE)} FCFA</span>
                  </div>
                  {(Number(order.pointsReduction) || 0) > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Réduction (points) :</span>
                      <span>-{formatPrice(Number(order.pointsReduction))} FCFA</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-green-600">
                    <span>Total :</span>
                    <span>{formatPrice(totalWithDelivery)} FCFA</span>
                  </div>
                </div>
              </div>
            <div className="space-y-1">
              <label className="block font-bold text-xs">Statut :</label>
              <select
                className="w-full p-1 border rounded text-xs"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <button className="w-full bg-blue-600 text-white p-1 rounded hover:bg-blue-700 text-xs" onClick={handleStatusChange}>
                Appliquer
              </button>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white p-3 border-t flex gap-2">
          <button
            className="flex-1 bg-gray-500 text-white p-1 rounded hover:bg-gray-600 text-xs"
            onClick={handleOpenFeeModal}
          >
            Modifier frais
          </button>
          <button
            className="flex-1 bg-red-600 text-white p-1 rounded hover:bg-red-700 text-xs"
            onClick={() => {
              if (window.confirm("Supprimer cette commande ?")) {
                onDelete(order.id);
                onClose();
              }
            }}
          >
            Supprimer
          </button>
          <button className="flex-1 bg-gray-200 p-1 rounded hover:bg-gray-300 text-xs" onClick={onClose}>
            Fermer
          </button>
        </div>
        {showFailureModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-3 rounded-lg shadow-lg w-full max-w-xs">
              <h4 className="text-sm font-semibold mb-2">Motif de l'échec</h4>
              <select
                className="w-full p-1 border rounded text-xs mb-2"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
              >
                <option value="">Sélectionner un motif</option>
                {FAILURE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="flex-1 bg-gray-200 p-1 rounded hover:bg-gray-300 text-xs" onClick={() => setShowFailureModal(false)}>
                  Annuler
                </button>
                <button
                  className="flex-1 bg-blue-600 text-white p-1 rounded hover:bg-blue-700 text-xs"
                  onClick={handleFailureSubmit}
                  disabled={!failureReason}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
        {showFeeModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-3 rounded-lg shadow-lg w-full max-w-xs">
              <h4 className="text-sm font-semibold mb-2">Modifier les frais de livraison</h4>
              {feeError && <p className="text-red-600 text-xs mb-2">{feeError}</p>}
              {feeSuccessMessage && <p className="text-green-600 text-xs mb-2">{feeSuccessMessage}</p>}
              <div className="flex items-center space-x-2 mb-2">
                <button
                  className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"
                  onClick={() => handleFeeChange(-100)}
                  disabled={newFee <= 0 || isSavingFees}
                >
                  -
                </button>
                <input
                  type="number"
                  value={newFee}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewFee(value === "" ? 0 : Number(value));
                    setFeeError(null);
                  }}
                  className="w-full p-1 border rounded text-xs"
                  min="0"
                  step="100"
                  aria-label="Frais de livraison en FCFA"
                  disabled={isSavingFees}
                />
                <button
                  className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"
                  onClick={() => handleFeeChange(100)}
                  disabled={isSavingFees}
                >
                  +
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 bg-gray-200 p-1 rounded hover:bg-gray-300 text-xs"
                  onClick={handleCancelFeeEdit}
                  disabled={isSavingFees}
                >
                  Annuler
                </button>
                <button
                  className="flex-1 bg-blue-600 text-white p-1 rounded hover:bg-blue-700 text-xs disabled:bg-blue-300"
                  onClick={handleSaveFees}
                  disabled={isSavingFees || validateFee()}
                >
                  {isSavingFees ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});


const RestaurantAdmin = () => {
  const [restaurant, setRestaurant] = useState(null);
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    adresse: "",
    city: "",
    location: "",
    contact: "",
  });
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [usersData, setUsersData] = useState({});
  const [deliveryFees, setDeliveryFees] = useState({});
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("restaurant");
  const [viewMode, setViewMode] = useState("kanban");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateFilterMode, setDateFilterMode] = useState('day');
  const [editingMenu, setEditingMenu] = useState(null);
  const daysOfWeek = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const [showPendingOrdersModal, setShowPendingOrdersModal] = useState(true);

  const [editingCategory, setEditingCategory] = useState(null);
  const [menuData, setMenuData] = useState({ 
    name: "", 
    covers: [], 
    coverPreviews: [] 
  });
  const [categoryData, setCategoryData] = useState({
    name: "",
    description: "",
    icon: "", // Assurez-vous que c'est une chaîne vide
    iconFile: null,
    iconPreview: "",
  });
  const [itemData, setItemData] = useState({
    name: "",
    description: "",
    priceType: "single",
    price: "", // Remplace singlePrice
    sizes: { L: "", XL: "" },
    saleMode: "pack",
    categoryId: "",
    available: true,
    scheduledDay: [],
    needAssortement: false,
    assortments: [],
    extraLists: [],
    quantityleft: 0,
    covers: [],
    coverPreviews: [],
    menuId: "",
  });
  const [editingItem, setEditingItem] = useState(null);
  const [extraListData, setExtraListData] = useState({
    name: "",
    extraListElements: [{ name: "", price: "", required: false, multiple: false }],
  });

  const resetItemForm = () => {
    setItemData({
      name: "",
      description: "",
      priceType: "single",
      price: "", // Remplace singlePrice
      sizes: { L: "", XL: "" },
      saleMode: "pack",
      categoryId: "",
      available: true,
      scheduledDay: [],
      needAssortement: false,
      assortments: [],
      extraLists: [],
      quantityleft: 0,
      covers: [],
      coverPreviews: [],
      menuId: "",
    });
    setEditingItem(null);
  };

  const statusColumns = useMemo(
    () => [
      { id: ORDER_STATUS.PENDING, name: STATUS_LABELS[ORDER_STATUS.PENDING], color: STATUS_COLUMN_COLORS[ORDER_STATUS.PENDING] },
      { id: ORDER_STATUS.PREPARING, name: STATUS_LABELS[ORDER_STATUS.PREPARING], color: STATUS_COLUMN_COLORS[ORDER_STATUS.PREPARING] },
      { id: ORDER_STATUS.READY_TO_DELIVER, name: STATUS_LABELS[ORDER_STATUS.READY_TO_DELIVER], color: STATUS_COLUMN_COLORS[ORDER_STATUS.READY_TO_DELIVER] },
      { id: ORDER_STATUS.DELIVERING, name: STATUS_LABELS[ORDER_STATUS.DELIVERING], color: STATUS_COLUMN_COLORS[ORDER_STATUS.DELIVERING] },
      { id: ORDER_STATUS.DELIVERED, name: STATUS_LABELS[ORDER_STATUS.DELIVERED], color: STATUS_COLUMN_COLORS[ORDER_STATUS.DELIVERED] },
    ],
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "restaurants"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const restaurantDoc = querySnapshot.docs[0];
          setCurrentRestaurantId(restaurantDoc.id);
          const data = restaurantDoc.data();
          setRestaurant({ id: restaurantDoc.id, ...data });
          setRestaurantForm({
            name: data.name || "",
            adresse: data.adresse || "",
            city: data.city || "",
            location: data.location || "",
            contact: data.contact || "",
          });
        }
        const usersSnap = await getDocs(collection(db, "usersrestau"));
        setUsersData({
          byId: usersSnap.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}),
          byPhone: usersSnap.docs.reduce((acc, doc) => {
            if (doc.data().phone) acc[doc.data().phone] = doc.data();
            return acc;
          }, {}),
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (!currentRestaurantId) return;

    const fetchStaticData = async () => {
      try {
        const [menusSnap, categoriesSnap, itemsSnap, extraListsSnap, feesSnap] = await Promise.all([
          getDocs(query(collection(db, "menus"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(query(collection(db, "categories"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(query(collection(db, "items"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(query(collection(db, "extraLists"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(collection(db, "quartiers")),
        ]);

        setMenus(menusSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setCategories(categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setItems(itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setExtraLists(extraListsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setDeliveryFees(
          feesSnap.docs.reduce((acc, doc) => ({
            ...acc,
            [doc.data().name]: doc.data().fee,
          }), {})
        );
      } catch (err) {
        console.error("Erreur lors de la récupération des données statiques:", err);
        setError("Erreur lors du chargement des données statiques");
      }
    };

    const ordersQuery = query(collection(db, "orders"));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const allOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || ORDER_STATUS.PENDING,
      }));
      setOrders(allOrders);
    }, (err) => {
      console.error("Erreur dans l'écoute des commandes:", err);
      setError("Erreur dans le suivi des commandes");
    });

    fetchStaticData();
    return () => unsubscribeOrders();
  }, [currentRestaurantId]);

  const formatDateForComparison = (date) => {
    return date.toISOString().split('T')[0];
  };

  const filterOrdersByDate = (orders, date, mode) => {
    const selected = new Date(date);
    return orders.filter((order) => {
      if (!order.timestamp) return false;
      const orderDate = new Date(order.timestamp.seconds * 1000);
      
      switch (mode) {
        case 'day':
          return formatDateForComparison(orderDate) === formatDateForComparison(selected);
        case 'week':
          const startOfWeek = new Date(selected);
          startOfWeek.setDate(selected.getDate() - selected.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return orderDate >= startOfWeek && orderDate <= endOfWeek;
        case 'month':
          return orderDate.getMonth() === selected.getMonth() && 
                 orderDate.getFullYear() === selected.getFullYear();
        default:
          return true;
      }
    });
  };

  const filteredOrders = useMemo(() => {
    if (!items.length) return [];
    const dateFilteredOrders = filterOrdersByDate(orders, selectedDate, dateFilterMode);
    return dateFilteredOrders.filter((order) =>
      order.items?.some((item) => items.some((it) => it.id === item.dishId))
    );
  }, [orders, items, selectedDate, dateFilterMode]);

  const getDeliveryFee = (destination) => {
    return deliveryFees[destination] ?? DEFAULT_DELIVERY_FEE;
  };

  const uploadImages = useCallback(async (files) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const validFiles = files.filter(file => 
      allowedTypes.includes(file.type) && file.size <= maxSize
    );
  
    if (validFiles.length !== files.length) {
      setError("Certains fichiers sont invalides (type ou taille > 5MB).");
    }
  
    const urls = await Promise.all(
      validFiles.map(async (file) => {
        const fileRef = ref(storage, `menus/${uuidv4()}_${file.name}`);
        await uploadBytes(fileRef, file);
        return getDownloadURL(fileRef);
      })
    );
    return urls;
  }, []);

const pendingOrders = useMemo(() => {
    return filteredOrders.filter(
      (order) => !order.status || order.status === ORDER_STATUS.PENDING
    );
  }, [filteredOrders]);
  const addMenu = async () => {
    if (!menuData.name) {
      setError("Le nom du menu est requis.");
      return;
    }
  
    try {
      setLoading(true);
      setError(null);
      const uploadedCovers = menuData.covers.length > 0 ? await uploadImages(menuData.covers) : [];
      const newMenu = { 
        name: menuData.name, 
        restaurantId: currentRestaurantId, 
        covers: uploadedCovers,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "menus"), newMenu);
      setMenus([...menus, { id: docRef.id, ...newMenu }]);
  
      if (window.fbq) {
        window.fbq('trackCustom', 'AddMenu', {
          content_ids: [docRef.id],
          content_name: menuData.name,
          content_type: 'menu',
          restaurant_id: currentRestaurantId,
        });
      }
  
      setMenuData({ name: "", covers: [], coverPreviews: [] });
    } catch (error) {
      console.error("Erreur lors de la création du menu:", error);
      setError("Erreur lors de la création du menu : " + error.message);
    } finally {
      setLoading(false);
    }
  };
  const addCategory = async () => {
    if (!categoryData.name) {
      setError("Le nom de la catégorie est requis.");
      return;
    }
  
    try {
      setLoading(true);
      setError(null);
  
      // Log pour déboguer l'état
      console.log("categoryData avant création:", categoryData);
  
      // Gestion de l'icône
      let iconUrl = "";
      if (categoryData.iconFile) {
        const uploadedUrls = await uploadImages([categoryData.iconFile]);
        console.log("uploadedUrls:", uploadedUrls);
        iconUrl = uploadedUrls[0] || ""; // Utiliser une chaîne vide si aucun URL n'est retourné
      } else {
        iconUrl = categoryData.icon || "";
      }
  
      // Log pour vérifier iconUrl
      console.log("iconUrl final:", iconUrl);
  
      const newCategory = {
        name: categoryData.name,
        description: categoryData.description || "",
        icon: iconUrl,
        restaurantId: currentRestaurantId,
        createdAt: Timestamp.now(),
      };
  
      // Validation finale avant envoi
      if (Object.values(newCategory).some((value) => value === undefined)) {
        console.error("Données invalides détectées:", newCategory);
        throw new Error("Données invalides détectées dans newCategory");
      }
  
      const docRef = await addDoc(collection(db, "categories"), newCategory);
      setCategories([...categories, { id: docRef.id, ...newCategory }]);
      setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
  
      if (window.fbq) {
        window.fbq("trackCustom", "AddCategory", {
          content_ids: [docRef.id],
          content_name: categoryData.name,
          content_type: "category",
          restaurant_id: currentRestaurantId,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la création de la catégorie:", error);
      setError("Erreur lors de la création de la catégorie : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addExtraList = async () => {
    if (!extraListData.name) return;
    try {
      const newExtraList = { ...extraListData, restaurantId: currentRestaurantId };
      const docRef = await addDoc(collection(db, "extraLists"), newExtraList);
      setExtraLists([...extraLists, { id: docRef.id, ...newExtraList }]);
      setExtraListData({
        name: "",
        extraListElements: [{ name: "", price: "", required: false, multiple: false }],
      });
    } catch (error) {
      console.error("Erreur lors de la création de l'extra list:", error);
      setError("Erreur lors de la création de l'extra list");
    }
  };

  const deleteMenu = async (menuId) => {
    try {
      await deleteDoc(doc(db, "menus", menuId));
      setMenus(menus.filter((menu) => menu.id !== menuId));
    } catch (error) {
      console.error("Erreur lors de la suppression du menu:", error);
      setError("Erreur lors de la suppression du menu");
    }
  };

  const deleteCategory = async (categoryId) => {
    try {
      await deleteDoc(doc(db, "categories", categoryId));
      setCategories(categories.filter((category) => category.id !== categoryId));
    } catch (error) {
      console.error("Erreur lors de la suppression de la catégorie:", error);
      setError("Erreur lors de la suppression de la catégorie");
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, "items", itemId));
      setItems(items.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error("Erreur lors de la suppression du plat:", error);
      setError("Erreur lors de la suppression du plat");
    }
  };

  const deleteExtraList = async (extraListId) => {
    try {
      await deleteDoc(doc(db, "extraLists", extraListId));
      setExtraLists(extraLists.filter((ex) => ex.id !== extraListId));
    } catch (error) {
      console.error("Erreur lors de la suppression de l'extra list:", error);
      setError("Erreur lors de la suppression de l'extra list");
    }
  };

  const deleteOrder = async (orderId) => {
    try {
      await deleteDoc(doc(db, "orders", orderId));
      console.log(`Commande ${orderId} supprimée avec succès`);
    } catch (error) {
      console.error("Erreur lors de la suppression de la commande:", error);
      setError("Erreur lors de la suppression de la commande");
    }
  };
  const updateMenu = async () => {
    if (!editingMenu || !menuData.name) {
      setError("Le nom du menu est requis pour la mise à jour.");
      return;
    }
  
    try {
      setLoading(true);
      setError(null);
      const newCovers = menuData.covers.filter(file => file instanceof File);
      const existingCovers = menuData.covers.filter(url => typeof url === "string");
      const uploadedCovers = newCovers.length > 0 ? await uploadImages(newCovers) : [];
      const updatedCovers = [...existingCovers, ...uploadedCovers];
      const updatedData = { 
        name: menuData.name, 
        covers: updatedCovers,
        updatedAt: Timestamp.now(),
      };
      await updateDoc(doc(db, "menus", editingMenu.id), updatedData);
      setMenus(menus.map((menu) => 
        menu.id === editingMenu.id ? { ...menu, ...updatedData } : menu
      ));
      setEditingMenu(null);
      setMenuData({ name: "", covers: [], coverPreviews: [] });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du menu:", error);
      setError("Erreur lors de la mise à jour du menu : " + error.message);
    } finally {
      setLoading(false);
    }
  };
  const startEditingMenu = (menu) => {
    setEditingMenu(menu);
    setMenuData({
      name: menu.name,
      covers: menu.covers || [],
      coverPreviews: menu.covers || [],
    });
  };
  const updateCategory = async () => {
    if (!editingCategory || !categoryData.name) {
      setError("Le nom de la catégorie est requis.");
      return;
    }
  
    try {
      setLoading(true);
      setError(null);
  
      // Log pour déboguer
      console.log("categoryData avant mise à jour:", categoryData);
  
      // Gestion de l'icône
      let iconUrl = "";
      if (categoryData.iconFile) {
        const uploadedUrls = await uploadImages([categoryData.iconFile]);
        console.log("uploadedUrls:", uploadedUrls);
        iconUrl = uploadedUrls[0] || "";
      } else {
        iconUrl = categoryData.icon || "";
      }
  
      // Log pour vérifier iconUrl
      console.log("iconUrl final:", iconUrl);
  
      const updatedData = {
        name: categoryData.name,
        description: categoryData.description || "",
        icon: iconUrl,
        updatedAt: Timestamp.now(),
      };
  
      // Validation finale avant envoi
      if (Object.values(updatedData).some((value) => value === undefined)) {
        console.error("Données invalides détectées:", updatedData);
        throw new Error("Données invalides détectées dans updatedData");
      }
  
      await updateDoc(doc(db, "categories", editingCategory.id), updatedData);
      setCategories(
        categories.map((category) =>
          category.id === editingCategory.id ? { ...category, ...updatedData } : category
        )
      );
      setEditingCategory(null);
      setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la catégorie:", error);
      setError("Erreur lors de la mise à jour de la catégorie : " + error.message);
    } finally {
      setLoading(false);
    }
  };
  const startEditingCategory = (category) => {
    setEditingCategory(category);
    setCategoryData({
      name: category.name,
      description: category.description,
      icon: category.icon || "",
      iconFile: null,
      iconPreview: category.icon || "",
    });
  };

  const addItem = async () => {
    if (!itemData.name || !itemData.categoryId || !itemData.menuId) {
      setError("Tous les champs obligatoires doivent être remplis.");
      return;
    }
    if (itemData.priceType === "single" && !itemData.price) {
      setError("Le prix est requis.");
      return;
    }
    if (itemData.priceType === "sizes" && (!itemData.sizes.L || !itemData.sizes.XL)) {
      setError("Les prix pour L et XL sont requis.");
      return;
    }
  
    try {
      const uploadedCovers = await uploadImages(itemData.covers);
      if (itemData.covers.length > 0 && uploadedCovers.length === 0) {
        setError("Échec du téléchargement des images");
        return;
      }
      const priceValue = itemData.priceType === "single" 
        ? convertPrice(itemData.price) 
        : Math.min(convertPrice(itemData.sizes.L || 0), convertPrice(itemData.sizes.XL || 0));
      if (isNaN(priceValue)) {
        setError("Prix invalide");
        return;
      }
      const newItem = {
        ...itemData,
        covers: uploadedCovers,
        restaurantId: currentRestaurantId,
        ...(itemData.priceType === "single" ? { price: itemData.price } : { sizes: itemData.sizes }),
      };
      const docRef = await addDoc(collection(db, "items"), newItem);
      setItems([...items, { id: docRef.id, ...newItem }]);
      await updateDoc(doc(db, "menus", itemData.menuId), { items: arrayUnion(docRef.id) });
  
      if (window.fbq) {
        window.fbq('track', 'AddProduct', {
          content_ids: [docRef.id],
          content_name: itemData.name,
          content_type: 'product',
          value: priceValue,
          currency: 'XAF',
          restaurant_id: currentRestaurantId,
        });
      } else {
        console.warn("Pixel Facebook non initialisé");
      }
  
      resetItemForm();
    } catch (error) {
      console.error("Erreur lors de l'ajout du plat:", error);
      setError("Erreur lors de l'ajout du plat : " + error.message);
      return;
    }
  };
  const updateItem = async (itemId, newData) => {
    try {
      const uploadedCovers = newData.covers.some(file => file instanceof File)
        ? await uploadImages(newData.covers.filter(file => file instanceof File))
        : [];
      const updatedCovers = [
        ...(newData.covers.filter(url => typeof url === "string")),
        ...uploadedCovers,
      ];
      const priceValue = newData.priceType === "single" 
        ? convertPrice(newData.price) 
        : Math.min(convertPrice(newData.sizes.L), convertPrice(newData.sizes.XL));
      const updatedData = {
        ...newData,
        covers: updatedCovers,
        ...(newData.priceType === "single" ? { price: newData.price } : { sizes: newData.sizes }), // price au lieu de singlePrice
      };
      await updateDoc(doc(db, "items", itemId), updatedData);
      setItems(items.map((item) => (item.id === itemId ? { ...item, ...updatedData } : item)));

      // Événement Pixel Facebook (optionnel)
      window.fbq('trackCustom', 'ModifyProduct', {
        content_ids: [itemId],
        content_name: newData.name,
        content_type: 'product',
        value: priceValue,
        currency: 'XAF',
        restaurant_id: currentRestaurantId,
      });

      resetItemForm();
    } catch (error) {
      console.error("Erreur lors de la mise à jour du plat:", error);
      setError("Erreur lors de la mise à jour du plat");
    }
  };



const startEditing = (item) => {
  console.log("Item passé à startEditing :", item); // Pour débogage
  setEditingItem(item);
  const newItemData = {
    name: item.name || "",
    description: item.description || "",
    priceType: item.price ? "single" : "sizes",
    price: item.price ? String(item.price) : "",
    sizes: item.sizes
      ? {
          L: item.sizes.L !== undefined ? String(item.sizes.L) : "",
          XL: item.sizes.XL !== undefined ? String(item.sizes.XL) : "",
        }
      : { L: "", XL: "" },
    saleMode: item.saleMode || "pack",
    categoryId: item.categoryId || "",
    available: item.available !== undefined ? item.available : true,
    scheduledDay: Array.isArray(item.scheduledDay) ? item.scheduledDay : [],
    needAssortement: item.needAssortement !== undefined ? item.needAssortement : false,
    assortments: Array.isArray(item.assortments) ? item.assortments : [],
    extraLists: Array.isArray(item.extraLists) ? item.extraLists : [],
    quantityleft: item.quantityleft !== undefined ? Number(item.quantityleft) : 0,
    covers: Array.isArray(item.covers) ? item.covers : [],
    coverPreviews: Array.isArray(item.covers) ? item.covers : [],
    menuId: item.menuId || "",
  };
  console.log("Nouvel itemData :", newItemData); // Pour débogage
  setItemData(newItemData);
};
  const updateRestaurantInfo = async () => {
    try {
      const restaurantRef = doc(db, "restaurants", currentRestaurantId);
      await updateDoc(restaurantRef, { ...restaurantForm, updatedAt: Timestamp.now() });
      setRestaurant({ ...restaurant, ...restaurantForm });
      alert("Informations du restaurant mises à jour");
    } catch (error) {
      console.error("Erreur lors de la mise à jour du restaurant:", error);
      setError("Erreur lors de la mise à jour du restaurant");
    }
  };

  const updateOrderDeliveryFees = async (orderId, destination, newFee) => {
    const feeNumber = Number(newFee);
    if (isNaN(feeNumber) || feeNumber < 0) return;

    try {
      const orderRef = doc(db, "orders", orderId);
      if (deliveryFees[destination] === undefined) {
        await setDoc(doc(db, "quartiers", destination), {
          fee: feeNumber,
          name: destination,
        });
        setDeliveryFees((prev) => ({ ...prev, [destination]: feeNumber }));
      }
      await updateDoc(orderRef, {
        deliveryFees: feeNumber,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Erreur de mise à jour des frais:", error);
      setError("Erreur lors de la mise à jour des frais");
    }
  };

  const updateOrderStatus = async (orderId, status, reason = null, isPaid = false) => {
    try {
      if (!orderId || !auth.currentUser || !currentRestaurantId) {
        throw new Error("Informations manquantes pour mettre à jour le statut.");
      }
  
      const orderRef = doc(db, "orders", orderId);
      const statusHistoryRef = collection(orderRef, "statusHistory");
      const notificationsRef = collection(db, "notifications");
      const statusData = {
        status,
        timestamp: Timestamp.now(),
      };
      if (reason) statusData.reason = reason;
  
      await addDoc(statusHistoryRef, statusData);
      await updateDoc(orderRef, { status, isPaid, updatedAt: Timestamp.now() });
  
      const orderDoc = await getDoc(orderRef);
      if (!orderDoc.exists()) {
        throw new Error("La commande n'existe pas.");
      }
      const orderData = orderDoc.data();
      const { totalWithDelivery } = calculateOrderTotals(orderData, extraLists);
  
      if (status === ORDER_STATUS.DELIVERED && window.fbq) {
        window.fbq('track', 'Purchase', {
          value: totalWithDelivery,
          currency: 'XAF',
          content_ids: orderData.items.map(item => item.dishId),
          content_type: 'product',
          order_id: orderId,
          restaurant_id: currentRestaurantId,
        });
      }
  
      const notificationData = {
        orderId: orderId,
        oldStatus: orderData.status || ORDER_STATUS.PENDING,
        newStatus: status,
        timestamp: Timestamp.now(),
        userId: orderData.userId || "unknown",
        restaurantId: orderData.restaurantId || currentRestaurantId,
        read: false,
      };
      await addDoc(notificationsRef, notificationData);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut ou création de la notification:", error);
      setError(`Erreur: ${error.message}`);
    }
  };

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
    e.currentTarget.classList.add("bg-gray-200");
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove("bg-gray-200");
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-gray-200");
    if (!draggedOrder || draggedOrder.status === newStatus) return;
    await updateOrderStatus(draggedOrder.id, newStatus);
  };

  const handleDaySelection = (day) => {
    setItemData({
      ...itemData,
      scheduledDay: itemData.scheduledDay.includes(day)
        ? itemData.scheduledDay.filter((d) => d !== day)
        : [...itemData.scheduledDay, day],
    });
  };

  const addExtraElement = () => {
    setExtraListData({
      ...extraListData,
      extraListElements: [
        ...extraListData.extraListElements,
        { name: "", price: "", required: false, multiple: false },
      ],
    });
  };

  const updateExtraElement = (index, field, value) => {
    const newElements = extraListData.extraListElements.map((el, i) => {
      if (i !== index) return el;
      const updatedElement = { ...el, [field]: value };
      if (field === "required" && value) updatedElement.multiple = false;
      if (field === "multiple" && value) updatedElement.required = false;
      return updatedElement;
    });
    setExtraListData({ ...extraListData, extraListElements: newElements });
  };

  const showOrderDetails = (order) => {
    setSelectedOrder(order);
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
  };

  const handlePreviousPeriod = () => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === 'day') newDate.setDate(newDate.getDate() - 1);
    else if (dateFilterMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (dateFilterMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === 'day') newDate.setDate(newDate.getDate() + 1);
    else if (dateFilterMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (dateFilterMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };
  const addAvailabilityToExistingItems = async () => {
    try {
      setLoading(true);
      const itemsToUpdate = items.filter(item => typeof item.available === "undefined");
  
      if (itemsToUpdate.length === 0) {
        alert("Tous les produits ont déjà un champ 'available'.");
        setLoading(false);
        return;
      }
  
      for (const item of itemsToUpdate) {
        const updatedData = {
          ...item,
          available: true, // Valeur par défaut : "in stock" (true)
          updatedAt: Timestamp.now(),
        };
  
        await updateDoc(doc(db, "items", item.id), { available: true, updatedAt: Timestamp.now() });
        console.log(`Champ 'available' ajouté au produit ${item.id}`);
      }
  
      alert(`Mise à jour terminée : ${itemsToUpdate.length} produits corrigés.`);
    } catch (error) {
      console.error("Erreur lors de l'ajout du champ 'available' :", error);
      setError("Erreur lors de la mise à jour des produits");
    } finally {
      setLoading(false);
    }
  };
  const generateSchemaOrgJSONLD = (items) => {
    return items.map((item) => ({
      "@context": "https://schema.org",
      "@type": "Product",
      "id": item.id,
      "name": item.name,
      "description": item.description || "Description non disponible",
      "image": item.covers?.[0] || "https://www.mangedabord.com/logo192.png",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "XAF",
        "price": item.priceType === "single" 
          ? convertPrice(item.price || "0") 
          : Math.min(convertPrice(item.sizes?.L || "0"), convertPrice(item.sizes?.XL || "0")),
        "availability": item.available === true 
          ? "https://schema.org/InStock" 
          : "https://schema.org/OutOfStock", // Utilise la nouvelle valeur
      },
      "url": `https://www.mangedabord.com/product/${item.id}`,
    }));
  };
  
  useEffect(() => {
    if (items.length > 0) {
      const schemaData = generateSchemaOrgJSONLD(items);
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(schemaData);
      document.head.appendChild(script);
      return () => document.head.removeChild(script);
    }
  }, [items]);
  
  // Ajoutez un bouton dans votre UI sous la section "items"
  <div className="mt-4">
    <button
      className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
      onClick={addAvailabilityToExistingItems}
      disabled={loading}
    >
      {loading ? "Mise à jour en cours..." : "Ajouter 'available' aux produits existants"}
    </button>
  </div>
  return (
    <div className="container mt-4">
      <h2>Administration de {restaurant?.name || "votre restaurant"}</h2>
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
        <>
        {showPendingOrdersModal && pendingOrders.length > 0 && (
            <PendingOrdersModal
              orders={pendingOrders}
              items={items}
              extraLists={extraLists}
              usersData={usersData}
              onClose={() => setShowPendingOrdersModal(false)}
            />
          )}
          <ul className="nav nav-tabs mb-4">
            {["restaurant", "menus", "items", "categories", "orders", "extras","loyalty"].map((tab) => (
              <li key={tab} className="nav-item">
                <button
                  className={`nav-link ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "restaurant"
          ? "Infos Restaurant"
          : tab === "menus"
          ? "Gestion des Menus"
          : tab === "items"
          ? "Gestion des Plats"
          : tab === "categories"
          ? "Gestion des Catégories"
          : tab === "orders"
          ? "Commandes"
          : tab === "extras"
          ? "Extras"
          : "Points de fidélité"}
                </button>
              </li>
            ))}
          </ul>

          {activeTab === "restaurant" && (
            <div>
              <h3>Infos Restaurant</h3>
              {["name", "adresse", "city", "location", "contact"].map((field) => (
                <input
                  key={field}
                  type="text"
                  name={field}
                  placeholder={
                    field === "name"
                      ? "Nom du restaurant"
                      : field === "adresse"
                      ? "Adresse"
                      : field === "city"
                      ? "Ville"
                      : field === "location"
                      ? "Coordonnées GPS"
                      : "Contact"
                  }
                  className="form-control mb-2"
                  value={restaurantForm[field]}
                  onChange={(e) => setRestaurantForm({ ...restaurantForm, [field]: e.target.value })}
                />
              ))}
              <button className="btn btn-primary" onClick={updateRestaurantInfo}>
                Mettre à jour les infos
              </button>
            </div>
          )}

            {activeTab === "menus" && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">
                    {editingMenu ? "Modifier le Menu" : "Créer un Menu"}
                  </h3>
                  {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom du menu *</label>
                      <input
                        type="text"
                        placeholder="Nom du menu"
                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                          !menuData.name && error ? "border-red-500" : ""
                        }`}
                        value={menuData.name}
                        onChange={(e) => setMenuData({ ...menuData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Images du menu</label>
                      <input
                        type="file"
                        multiple
                        className="w-full p-2 border rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          const previews = files.map(file => URL.createObjectURL(file));
                          setMenuData({ 
                            ...menuData, 
                            covers: editingMenu 
                              ? [...menuData.covers, ...files] 
                              : files,
                            coverPreviews: editingMenu 
                              ? [...menuData.coverPreviews, ...previews] 
                              : previews 
                          });
                        }}
                      />
                    </div>
                    {menuData.coverPreviews.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Prévisualisation</label>
                        <div className="flex flex-wrap gap-2">
                          {menuData.coverPreviews.map((preview, index) => (
                            <div key={index} className="relative">
                              <img
                                src={preview}
                                alt={`Prévisualisation ${index + 1}`}
                                className="w-24 h-24 object-cover rounded-lg"
                              />
                              <button
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                onClick={() => {
                                  const newCovers = menuData.covers.filter((_, i) => i !== index);
                                  const newPreviews = menuData.coverPreviews.filter((_, i) => i !== index);
                                  setMenuData({ ...menuData, covers: newCovers, coverPreviews: newPreviews });
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex gap-4">
                    <button
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                      onClick={editingMenu ? updateMenu : addMenu}
                      disabled={loading}
                    >
                      {loading ? "Chargement..." : editingMenu ? "Mettre à jour" : "Créer Menu"}
                    </button>
                    {editingMenu && (
                      <button
                        className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                        onClick={() => {
                          setEditingMenu(null);
                          setMenuData({ name: "", covers: [], coverPreviews: [] });
                        }}
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">Liste des Menus</h3>
                  {menus.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Aucun menu ajouté pour le moment</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {menus.map((menu) => (
                        <div
                          key={menu.id}
                          className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                        >
                          <div className="flex items-start space-x-4">
                            {menu.covers?.length > 0 ? (
                              <div className="relative w-24 h-24">
                                <img
                                  src={menu.covers[0]}
                                  alt={menu.name}
                                  className="w-full h-full object-cover rounded-lg"
                                  onError={(e) => (e.target.src = "/img/default.png")}
                                />
                                {menu.covers.length > 1 && (
                                  <span className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs rounded-full px-2 py-1">
                                    +{menu.covers.length - 1}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-gray-500 text-sm">Aucune image</span>
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800">{menu.name}</h4>
                              <p className="text-xs text-gray-500 mt-1">ID Restaurant: {menu.restaurantId}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex justify-between">
                            <button
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              onClick={() => startEditingMenu(menu)}
                            >
                              Modifier
                            </button>
                            <button
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                              onClick={() => deleteMenu(menu.id)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "items" && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">
                    {editingItem ? "Modifier le plat" : "Ajouter un nouveau plat"}
                  </h3>
                  {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom du plat *</label>
                      <input
                        type="text"
                        placeholder="Entrez le nom du plat"
                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                          !itemData.name && error ? "border-red-500" : ""
                        }`}
                        value={itemData.name}
                        onChange={(e) => setItemData({ ...itemData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Menu *</label>
                      <select
                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                          !itemData.menuId && error ? "border-red-500" : ""
                        }`}
                        value={itemData.menuId}
                        onChange={(e) => setItemData({ ...itemData, menuId: e.target.value })}
                      >
                        <option value="">Sélectionner un menu</option>
                        {menus.map((menu) => (
                          <option key={menu.id} value={menu.id}>
                            {menu.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                      <select
                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                          !itemData.categoryId && error ? "border-red-500" : ""
                        }`}
                        value={itemData.categoryId}
                        onChange={(e) => setItemData({ ...itemData, categoryId: e.target.value })}
                      >
                        <option value="">Sélectionner une catégorie</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type de prix *</label>
                      <select
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        value={itemData.priceType}
                        onChange={(e) => setItemData({ ...itemData, priceType: e.target.value })}
                      >
                        <option value="single">Prix unique</option>
                        <option value="sizes">Prix par taille (L/XL)</option>
                      </select>
                    </div>
                    {itemData.priceType === "single" ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA) *</label>
                        <input
                          type="number"
                          placeholder="Prix"
                          className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                            !itemData.price && error ? "border-red-500" : ""
                          }`}
                          value={itemData.price}
                          onChange={(e) => setItemData({ ...itemData, price: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prix par taille (FCFA) *</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Prix L"
                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                              !itemData.sizes.L && error ? "border-red-500" : ""
                            }`}
                            value={itemData.sizes.L}
                            onChange={(e) => setItemData({ ...itemData, sizes: { ...itemData.sizes, L: e.target.value } })}
                          />
                          <input
                            type="number"
                            placeholder="Prix XL"
                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                              !itemData.sizes.XL && error ? "border-red-500" : ""
                            }`}
                            value={itemData.sizes.XL}
                            onChange={(e) => setItemData({ ...itemData, sizes: { ...itemData.sizes, XL: e.target.value } })}
                          />
                        </div>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        placeholder="Décrivez le plat..."
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-y"
                        rows="3"
                        value={itemData.description}
                        onChange={(e) => setItemData({ ...itemData, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mode de vente</label>
                      <select
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        value={itemData.saleMode}
                        onChange={(e) => setItemData({ ...itemData, saleMode: e.target.value })}
                      >
                        <option value="pack">Pack</option>
                        <option value="kilo">Kilo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Images</label>
                      <input
                        type="file"
                        multiple
                        className="w-full p-2 border rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          const previews = files.map((file) => URL.createObjectURL(file));
                          setItemData({
                            ...itemData,
                            covers: editingItem ? [...itemData.covers, ...files] : files,
                            coverPreviews: editingItem ? [...itemData.coverPreviews, ...previews] : previews,
                          });
                        }}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Extras</label>
                      <div className="flex flex-wrap gap-2">
                        {extraLists.length > 0 ? (
                          extraLists.map((extra) => (
                            <div
                              key={extra.id}
                              className={`px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                                itemData.extraLists.includes(extra.id)
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                              onClick={() => {
                                setItemData({
                                  ...itemData,
                                  extraLists: itemData.extraLists.includes(extra.id)
                                    ? itemData.extraLists.filter((id) => id !== extra.id)
                                    : [...itemData.extraLists, extra.id],
                                });
                              }}
                            >
                              {extra.name} ({extra.extraListElements.length})
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-sm">Aucune liste d'extras disponible</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {itemData.coverPreviews?.length > 0 && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Prévisualisation des images</label>
                      <div className="flex flex-wrap gap-2">
                        {itemData.coverPreviews.map((preview, index) => (
                          <div key={index} className="relative">
                            <img
                              src={preview}
                              alt={`Prévisualisation ${index + 1}`}
                              className="w-24 h-24 object-cover rounded-lg"
                            />
                            <button
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                              onClick={() => {
                                const newCovers = itemData.covers.filter((_, i) => i !== index);
                                const newPreviews = itemData.coverPreviews.filter((_, i) => i !== index);
                                setItemData({ ...itemData, covers: newCovers, coverPreviews: newPreviews });
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jours de disponibilité</label>
                    <div className="flex flex-wrap gap-2">
                      {daysOfWeek.map((day) => (
                        <button
                          key={day}
                          type="button"
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            itemData.scheduledDay.includes(day)
                              ? "bg-green-500 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() => handleDaySelection(day)}
                        >
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-700 hover:bg-red-200"
                        onClick={() => setItemData({ ...itemData, scheduledDay: [] })}
                      >
                        Réinitialiser
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-4">
                    <button
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                      onClick={editingItem ? () => updateItem(editingItem.id, itemData) : addItem}
                    >
                      {editingItem ? "Mettre à jour" : "Ajouter le plat"}
                    </button>
                    {editingItem && (
                      <button
                        className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                        onClick={resetItemForm}
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">Liste des plats</h3>
                  {items.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Aucun plat ajouté pour le moment</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                        >
                          <div className="flex items-start space-x-4">
                            {item.covers?.length > 0 ? (
                              <div className="relative w-24 h-24">
                                <img
                                  src={item.covers[0]}
                                  alt={item.name}
                                  className="w-full h-full object-cover rounded-lg"
                                  onError={(e) => (e.target.src = "/img/default.png")}
                                />
                                {item.covers.length > 1 && (
                                  <span className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs rounded-full px-2 py-1">
                                    +{item.covers.length - 1}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-gray-500 text-sm">Aucune image</span>
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800">{item.name}</h4>
                              <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                              {item.price ? (
                                <p className="text-green-600 font-medium mt-1">{formatPrice(item.price)} FCFA</p>
                              ) : (
                                <p className="text-green-600 font-medium mt-1">
                                  L: {formatPrice(item.sizes?.L)} FCFA | XL: {formatPrice(item.sizes?.XL)} FCFA
                                </p>
                              )}
                              {item.menuId && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Menu: {menus.find((m) => m.id === item.menuId)?.name || item.menuId}
                                </p>
                              )}
                              {item.scheduledDay.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Disponible: {item.scheduledDay.join(", ")}
                                </p>
                              )}
                              {item.extraLists?.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Extras: {item.extraLists.map((id) => extraLists.find((ex) => ex.id === id)?.name || id).join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex justify-between">
                            <button
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              onClick={() => startEditing(item)}
                            >
                              Modifier
                            </button>
                            <button
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                              onClick={() => deleteItem(item.id)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

{activeTab === "categories" && (
  <div className="space-y-6">
    {/* Formulaire d'ajout/modification de catégorie */}
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">
        {editingCategory ? "Modifier la catégorie" : "Créer une nouvelle catégorie"}
      </h3>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la catégorie *</label>
          <input
            type="text"
            placeholder="Entrez le nom de la catégorie"
            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
              !categoryData.name && error ? "border-red-500" : ""
            }`}
            value={categoryData.name}
            onChange={(e) => setCategoryData({ ...categoryData, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            placeholder="Décrivez la catégorie..."
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-y"
            rows="3"
            value={categoryData.description}
            onChange={(e) => setCategoryData({ ...categoryData, description: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Icône</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="w-full p-2 border rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            onChange={(e) => {
              const file = e.target.files[0];
              setCategoryData({
                ...categoryData,
                iconFile: file,
                iconPreview: file ? URL.createObjectURL(file) : categoryData.icon,
              });
            }}
          />
        </div>
        {categoryData.iconPreview && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prévisualisation de l'icône</label>
            <div className="relative">
              <img
                src={categoryData.iconPreview}
                alt="Prévisualisation de l'icône"
                className="w-24 h-24 object-cover rounded-lg"
                onError={(e) => (e.target.src = "/img/default.png")}
              />
              <button
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                onClick={() =>
                  setCategoryData({ ...categoryData, iconFile: null, iconPreview: "", icon: "" })
                }
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 flex gap-4">
        <button
          className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
          onClick={editingCategory ? updateCategory : addCategory}
          disabled={loading || !categoryData.name}
        >
          {loading ? "Chargement..." : editingCategory ? "Mettre à jour" : "Créer catégorie"}
        </button>
        {editingCategory && (
          <button
            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            onClick={() => {
              setEditingCategory(null);
              setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
            }}
          >
            Annuler
          </button>
        )}
      </div>
    </div>

    {/* Liste des catégories */}
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Liste des catégories</h3>
      {categories.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Aucune catégorie ajoutée pour le moment</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
            >
              <div className="flex items-start space-x-4">
                {category.icon ? (
                  <img
                    src={category.icon}
                    alt={category.name}
                    className="w-24 h-24 object-cover rounded-lg"
                    onError={(e) => (e.target.src = "/img/default.png")}
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500 text-sm">Aucune icône</span>
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800">{category.name}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">{category.description || "Aucune description"}</p>
                  <p className="text-xs text-gray-500 mt-1">ID Restaurant: {category.restaurantId}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-between">
                <button
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  onClick={() => startEditingCategory(category)}
                >
                  Modifier
                </button>
                <button
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                  onClick={() => {
                    if (window.confirm("Voulez-vous vraiment supprimer cette catégorie ?")) {
                      deleteCategory(category.id);
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
  </div>
)}
            {activeTab === "orders" && (
              <div>
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
                    <button
                      className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300"
                      onClick={() => setViewMode(viewMode === "table" ? "kanban" : "table")}
                    >
                      {viewMode === "table" ? "Vue Kanban" : "Vue Tableau"}
                    </button>
                  </div>
                </div>

                <div className="mb-4 text-sm text-gray-600">
                  {dateFilterMode === "day" && `Commandes du ${selectedDate.toLocaleDateString("fr-FR")}`}
                  {dateFilterMode === "week" && (
                    (() => {
                      const start = new Date(selectedDate);
                      start.setDate(start.getDate() - start.getDay());
                      const end = new Date(start);
                      end.setDate(start.getDate() + 6);
                      return `Commandes de la semaine du ${start.toLocaleDateString("fr-FR")} au ${end.toLocaleDateString("fr-FR")}`;
                    })()
                  )}
                  {dateFilterMode === "month" && (
                    `Commandes de ${selectedDate.toLocaleString("fr-FR", { month: "long", year: "numeric" })}`
                  )}
                  {` (${filteredOrders.length} commande${filteredOrders.length !== 1 ? "s" : ""})`}
                </div>

                {viewMode === "kanban" ? (
                  <div className="overflow-x-auto whitespace-nowrap pb-4">
                    <div className="inline-flex gap-6">
                      {statusColumns.map((column) => (
                        <div
                          key={column.id}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, column.id)}
                          className={`p-4 rounded-lg border ${column.color} min-h-[500px] w-[350px] flex-shrink-0 shadow-sm`}
                        >
                          <h4 className="font-semibold text-lg mb-4 text-gray-800 sticky top-0 bg-inherit z-10 py-2">
                            {column.name} (
                            {
                              filteredOrders.filter((order) =>
                                column.id === ORDER_STATUS.PENDING
                                  ? !order.status || order.status === ORDER_STATUS.PENDING
                                  : order.status === column.id
                              ).length
                            }
                            )
                          </h4>
                          <div className="space-y-3 overflow-y-auto max-h-[450px]">
                            {filteredOrders
                              .filter((order) =>
                                column.id === ORDER_STATUS.PENDING
                                  ? !order.status || order.status === ORDER_STATUS.PENDING
                                  : order.status === column.id
                              )
                              .map((order) => (
                                <OrderCard
                                  key={order.id}
                                  order={order}
                                  items={items}
                                  extraLists={extraLists}
                                  usersData={usersData}
                                  onShowDetails={showOrderDetails}
                                  onDragStart={(e) => handleDragStart(e, order)}
                                  onDragEnd={handleDragEnd}
                                />
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <table className="table w-full text-xs">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Quartier</th>
                        <th>Adresse</th>
                        <th>Frais de livraison</th>
                        <th>ID Commande</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Points</th> {/* Nouvelle colonne pour indiquer l'utilisation des points */}
                        <th>Statut</th>
                        <th>Payé</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders?.map((order) => {
                        const user = order.userId
                          ? usersData.byId[order.userId]
                          : order.contact?.phone && usersData.byPhone[order.contact.phone];
                        const clientName = user
                          ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Utilisateur inconnu"
                          : order.contact?.name || "Client inconnu";
                        const phoneNumber = user?.phone || order.address?.phone || order.contact?.phone || "Non spécifié";
                        const address = order.address || {};
                        const quartier = address.area || "Non spécifié";
                        const description = address.completeAddress || "Non spécifié";
                        const deliveryFee = order.deliveryFee !== undefined ? Number(order.deliveryFee) : DEFAULT_DELIVERY_FEE;
                        const { subtotal, totalWithDelivery } = calculateOrderTotals(order, extraLists, items);

                        return (
                          <tr key={order.id}>
                            <td className="truncate">{clientName}</td>
                            <td className="truncate">{quartier}</td>
                            <td className="truncate">{description}</td>
                            <td>{formatPrice(deliveryFee)} FCFA</td>
                            <td className="truncate">#{order.id.slice(0, 6)}</td>
                            <td>
                              {order.timestamp
                                ? new Date(order.timestamp.seconds * 1000).toLocaleDateString("fr-FR")
                                : "N/A"}
                            </td>
                            <td className="text-green-600 font-semibold">{formatPrice(totalWithDelivery)} FCFA</td>
                            {/* Indicateur simple pour les points utilisés */}
                           <td>
                              {(Number(order.pointsUsed) || 0) > 0 
                                ? `✅ ${formatPrice(Number(order.pointsReduction) || 0)} FCFA` 
                                : "-"}
                            </td>
                            <td>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {STATUS_LABELS[order.status] || "En attente"}
                              </span>
                            </td>
                            <td className={order.isPaid ? "text-green-600" : "text-red-600"}>
                              {order.isPaid ? "Oui" : "Non"}
                            </td>
                            <td>
                              <button
                                className="btn btn-primary btn-sm text-xs bg-green-600 text-white rounded-lg px-3 py-1 hover:bg-green-700"
                                onClick={() => showOrderDetails(order)}
                              >
                                Détails
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {selectedOrder && (
                  <OrderDetailsModal
                    order={selectedOrder}
                    items={items}
                    extraLists={extraLists}
                    usersData={usersData}
                    onClose={closeOrderDetails}
                    onUpdateFees={updateOrderDeliveryFees}
                    onDelete={deleteOrder}
                    onUpdateStatus={updateOrderStatus}
                  />
                )}
              </div>
            )}

          {activeTab === "extras" && (
            <>
              <h3>Créer une Extra List</h3>
              <input
                type="text"
                placeholder="Nom de l'extra list"
                className="form-control mb-2"
                value={extraListData.name}
                onChange={(e) => setExtraListData({ ...extraListData, name: e.target.value })}
              />
              {extraListData.extraListElements.map((el, index) => (
                <div key={index} className="mb-2 p-2 border rounded">
                  <input
                    type="text"
                    placeholder="Nom de l'élément"
                    className="form-control mb-1"
                    value={el.name}
                    onChange={(e) => updateExtraElement(index, "name", e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Prix (facultatif)"
                    className="form-control mb-1"
                    value={el.price}
                    onChange={(e) => updateExtraElement(index, "price", e.target.value)}
                  />
                  <div className="d-flex gap-3">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={el.required}
                        onChange={(e) => updateExtraElement(index, "required", e.target.checked)}
                      />
                      <label className="form-check-label">Obligatoire</label>
                    </div>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={el.multiple}
                        onChange={(e) => updateExtraElement(index, "multiple", e.target.checked)}
                      />
                      <label className="form-check-label">Multiple</label>
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary mb-2" onClick={addExtraElement}>
                Ajouter un élément
              </button>
              <br />
              <button className="btn btn-success" onClick={addExtraList}>
                Créer Extra List
              </button>
              <h3 className="mt-4">Liste des Extras</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Éléments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {extraLists.map((extra) => (
                    <tr key={extra.id}>
                      <td>{extra.name}</td>
                      <td>
                        {extra.extraListElements
                          ?.map((el) =>
                            `${el.name}${el.price ? ` (${el.price} FCFA)` : ""} - ${
                              el.required ? "Obligatoire" : el.multiple ? "Multiple" : "Optionnel"
                            }`
                          )
                          .join(", ") || "Aucun élément"}
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteExtraList(extra.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {activeTab === "loyalty" && (
  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
    <h3 className="text-xl font-semibold mb-4 text-gray-800">Gestion des Points de Fidélité</h3>
    {currentRestaurantId ? (
      <LoyaltyPointsManager restaurantId={currentRestaurantId} />
    ) : (
      <p className="text-gray-500">Chargement des informations du restaurant...</p>
    )}
  </div>
)}
        </>
      )}
    </div>
  );
};

export default RestaurantAdmin; 