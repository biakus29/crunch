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
import { 
  FaUtensils, 
  FaListAlt, 
  FaBox, 
  FaTags, 
  FaShoppingBag, 
  FaPlusCircle, 
  FaCommentAlt, 
  FaStar, 
  FaCog, 
  FaBars, 
  FaTimes,
  FaHome,
  FaChartLine,
  FaUser,
  FaBell,
  FaSearch,
  FaChevronDown,
  FaChevronRight,
  FaChevronLeft,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaShippingFast
} from "react-icons/fa";
import { HiOutlineLogout } from "react-icons/hi";
import LoyaltyPointsManager from "./LoyaltyPoints";
import CreateOrderForm from "./CreateOrderForm";

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
  return { subtotal, totalWithDelivery, pointsReduction };
};

const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
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
              const currentItem = Array.isArray(items) ? items.find((it) => it.id === item.dishId) : null;
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
        selectedExtras: {},
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
  const [viewMode, setViewMode] = useState("kanban");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateFilterMode, setDateFilterMode] = useState('day');
  const [editingMenu, setEditingMenu] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [menuData, setMenuData] = useState({ 
    name: "", 
    covers: [], 
    coverPreviews: [] 
  });
  const [categoryData, setCategoryData] = useState({
    name: "",
    description: "",
    icon: "",
    iconFile: null,
    iconPreview: "",
  });
  const [itemData, setItemData] = useState({
    name: "",
    description: "",
    priceType: "single",
    price: "",
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
  const [editingExtraList, setEditingExtraList] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("orders");
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [activeMenuSubSection, setActiveMenuSubSection] = useState("menus");
  const [activeOrderSubSection, setActiveOrderSubSection] = useState("list");
const menuItems = [
  // { id: "dashboard", label: "Tableau de bord", icon: <FaHome /> },
  { id: "restaurant", label: "Infos Restaurant", icon: <FaCog /> },
  { id: "menus", label: "Menus", icon: <FaListAlt /> },
  { id: "orders", label: "Commandes", icon: <FaShoppingBag /> },
  { id: "categories", label: "Catégories", icon: <FaTags /> },
  { id: "loyalty", label: "Points Fidélité", icon: <FaStar /> },
  { id: "comments", label: "Avis Clients", icon: <FaCommentAlt /> },
];

  const resetItemForm = () => {
    setItemData({
      name: "",
      description: "",
      priceType: "single",
      price: "",
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

  const uploadImages = useCallback(async (files) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;
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
  return orders.filter((order) => 
    order && order.id && order.status === ORDER_STATUS.PENDING
  );
}, [orders]);
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

  const ratedOrders = orders.filter((order) => {
    const hasRating = order.rating && typeof order.rating === "object" && order.rating.rating !== undefined;
    const matchesRestaurant = order.restaurantId === currentRestaurantId;
    return hasRating && matchesRestaurant;
  });

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

    const feedbackQuery = query(
      collection(db, "feedback"),
      where("restaurantId", "==", currentRestaurantId)
    );
    const unsubscribeFeedback = onSnapshot(feedbackQuery, (snapshot) => {
      const feedbackData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFeedbacks(feedbackData);
    }, (err) => {
      console.error("Erreur dans l'écoute des feedbacks:", err);
      setError("Erreur dans le suivi des feedbacks");
    });

    fetchStaticData();
    return () => {
      unsubscribeOrders();
      unsubscribeFeedback();
    };
  }, [currentRestaurantId]);

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
  
      let iconUrl = "";
      if (categoryData.iconFile) {
        const uploadedUrls = await uploadImages([categoryData.iconFile]);
        iconUrl = uploadedUrls[0] || "";
      } else {
        iconUrl = categoryData.icon || "";
      }
  
      const newCategory = {
        name: categoryData.name,
        description: categoryData.description || "",
        icon: iconUrl,
        restaurantId: currentRestaurantId,
        createdAt: Timestamp.now(),
      };
  
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
  
      let iconUrl = "";
      if (categoryData.iconFile) {
        const uploadedUrls = await uploadImages([categoryData.iconFile]);
        iconUrl = uploadedUrls[0] || "";
      } else {
        iconUrl = categoryData.icon || "";
      }
  
      const updatedData = {
        name: categoryData.name,
        description: categoryData.description || "",
        icon: iconUrl,
        updatedAt: Timestamp.now(),
      };
  
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
        ...(newData.priceType === "single" ? { price: newData.price } : { sizes: newData.sizes }),
      };
      await updateDoc(doc(db, "items", itemId), updatedData);
      setItems(items.map((item) => (item.id === itemId ? { ...item, ...updatedData } : item)));

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
          available: true,
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
          : "https://schema.org/OutOfStock",
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

  return (
<div className="flex h-screen bg-gray-50 overflow-hidden">
  {/* Sidebar - Modern Design */}
  <div
    className={`bg-gradient-to-b from-green-700 to-green-800 text-white transition-all duration-300 fixed md:relative z-30 h-full 
      ${sidebarOpen ? "w-64" : "w-20"} ${mobileMenuOpen ? "block" : "hidden md:block"}`}
  >
    {/* Sidebar Header */}
    <div className="p-4 flex items-center justify-between border-b border-green-600 h-16">
      {sidebarOpen && (
        <div className="flex items-center">
          <h1 className="text-xl font-bold">{restaurant?.name || "Restaurant"}</h1>
        </div>
      )}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-1 rounded-full hover:bg-green-600 transition-colors"
      >
        {sidebarOpen ? <FaTimes className="w-5 h-5" /> : <FaBars className="w-5 h-5" />}
      </button>
    </div>

    {/* User Profile Mini */}
    {sidebarOpen && (
      <div className="p-4 border-b border-green-600 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
          <FaUser className="text-green-600" />
        </div>
        <div className="flex-1 truncate">
          <p className="font-medium truncate">{restaurant?.name || "Admin"}</p>
          <p className="text-xs text-green-200 truncate">Restaurant Manager</p>
        </div>
      </div>
    )}

      {/* Navigation */}
      <nav className="mt-4 px-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveSection(item.id);
              setMobileMenuOpen(false);
            }}
            className={`flex items-center w-full p-3 rounded-lg mb-1 text-left transition-colors ${
              activeSection === item.id ? "bg-white text-green-700 font-medium" : "text-white hover:bg-green-600"
            }`}
          >
            <span className="flex items-center">
              <span className={`${sidebarOpen ? "mr-3" : "mx-auto"}`}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </span>
            {sidebarOpen && activeSection === item.id && (
              <span className="ml-auto bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                Actif
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Sidebar Footer */}
      {sidebarOpen && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-green-600">
          <button
            className="flex items-center w-full p-2 text-white hover:bg-green-600 rounded-lg transition-colors"
            onClick={() => auth.signOut()}
          >
            <HiOutlineLogout className="mr-3" />
            Déconnexion
          </button>
        </div>
      )}
    </div>

    {/* Main Content Area */}
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-600 mr-4 md:hidden"
          >
            <FaBars className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-800">
            {menuItems.find((item) => item.id === activeSection)?.label || "Tableau de bord"}
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <button className="relative p-1 text-gray-500 hover:text-gray-700">
            <FaBell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="hidden md:flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <FaUser className="text-green-600" />
            </div>
            <span className="font-medium text-sm">{restaurant?.name || "Admin"}</span>
            <FaChevronDown className="text-gray-400 text-xs" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        {/* Dashboard Header Section */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {menuItems.find((item) => item.id === activeSection)?.label || "Tableau de bord"}
              </h2>
              <p className="text-gray-600 mt-1">
                {activeSection === "orders"
                  ? "Gestion des commandes"
                  : activeSection === "menus"
                    ? "Gestion de vos menus, plats et extras"
                    : activeSection === "restaurant"
                      ? "Informations de votre établissement"
                      : activeSection === "categories"
                        ? "Gestion des catégories"
                        : "Tableau de bord administratif"}
              </p>
            </div>

            {/* {activeSection === "orders" && (
              <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                  onClick={() => setShowPendingModal(true)}
                >
                  <FaShoppingBag className="mr-2" />
                  Commandes ({pendingOrders.length})
                </button>
              </div>
            )} */}
          </div>

          {activeSection === "orders" && (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center bg-white rounded-lg shadow-sm p-2">
                <button
                  className={`px-3 py-1 rounded-md ${
                    dateFilterMode === "day" ? "bg-green-100 text-green-700" : "text-gray-600"
                  }`}
                  onClick={() => setDateFilterMode("day")}
                >
                  Jour
                </button>
                <button
                  className={`px-3 py-1 rounded-md ${
                    dateFilterMode === "week" ? "bg-green-100 text-green-700" : "text-gray-600"
                  }`}
                  onClick={() => setDateFilterMode("week")}
                >
                  Semaine
                </button>
                <button
                  className={`px-3 py-1 rounded-md ${
                    dateFilterMode === "month" ? "bg-green-100 text-green-700" : "text-gray-600"
                  }`}
                  onClick={() => setDateFilterMode("month")}
                >
                  Mois
                </button>
              </div>

              <div className="flex items-center bg-white rounded-lg shadow-sm p-1">
                <button
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
                  onClick={handlePreviousPeriod}
                >
                  <FaChevronLeft />
                </button>
                <div className="px-3 py-1 text-sm font-medium">
                  {dateFilterMode === "day"
                    ? selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
                    : dateFilterMode === "week"
                      ? `Semaine ${getWeekNumber(selectedDate)}`
                      : selectedDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </div>
                <button
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
                  onClick={handleNextPeriod}
                >
                  <FaChevronRight />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards - Only for dashboard home */}
        {/* {activeSection === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Commandes aujourd'hui</p>
                  <p className="text-2xl font-bold mt-1">24</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <FaShoppingBag className="text-green-600" />
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2 flex items-center">
                <FaChartLine className="mr-1" /> +12% vs hier
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Revenu aujourd'hui</p>
                  <p className="text-2xl font-bold mt-1">{formatPrice(125000)} FCFA</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <FaMoneyBillWave className="text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2 flex items-center">
                <FaChartLine className="mr-1" /> +8% vs hier
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Livraisons en cours</p>
                  <p className="text-2xl font-bold mt-1">5</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <FaShippingFast className="text-purple-600" />
                </div>
              </div>
              <p className="text-xs text-purple-600 mt-2 flex items-center">
                <FaChartLine className="mr-1" /> 2 livraisons terminées
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Nouveaux clients</p>
                  <p className="text-2xl font-bold mt-1">3</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <FaUser className="text-yellow-600" />
                </div>
              </div>
              <p className="text-xs text-yellow-600 mt-2 flex items-center">
                <FaChartLine className="mr-1" /> +50% cette semaine
              </p>
            </div>
          </div>
        )} */}

        {/* Content Sections */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {activeSection === "restaurant" && (
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-6 text-gray-800">Informations du Restaurant</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {["name", "adresse", "city", "location", "contact"].map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field === "name"
                        ? "Nom du restaurant"
                        : field === "adresse"
                          ? "Adresse"
                          : field === "city"
                            ? "Ville"
                            : field === "location"
                              ? "Coordonnées GPS"
                              : "Contact"}
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      value={restaurantForm[field]}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, [field]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <button
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  onClick={updateRestaurantInfo}
                >
                  Mettre à jour
                </button>
              </div>
            </div>
          )}

          {activeSection === "menus" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Gestion des Menus</h2>
                <div className="flex flex-wrap gap-4 mb-4">
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      activeMenuSubSection === "menus" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                    } hover:bg-green-700 hover:text-white transition-colors`}
                    onClick={() => setActiveMenuSubSection("menus")}
                  >
                    Menus
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      activeMenuSubSection === "items" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                    } hover:bg-green-700 hover:text-white transition-colors`}
                    onClick={() => setActiveMenuSubSection("items")}
                  >
                    Plats
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      activeMenuSubSection === "extras" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                    } hover:bg-green-700 hover:text-white transition-colors`}
                    onClick={() => setActiveMenuSubSection("extras")}
                  >
                    Extras
                  </button>
                </div>

                {activeMenuSubSection === "menus" && (
                  <div>
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
                            const previews = files.map((file) => URL.createObjectURL(file));
                            setMenuData({
                              ...menuData,
                              covers: editingMenu ? [...menuData.covers, ...files] : files,
                              coverPreviews: editingMenu ? [...menuData.coverPreviews, ...previews] : previews,
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
                    <div className="mt-6">
                      <h2 className="text-2xl font-bold mb-6">Liste des Menus</h2>
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
                {activeMenuSubSection === "items" && (
                  <div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h2 className="text-2xl font-bold mb-6">Gestion des Plats</h2>
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
                                onChange={(e) =>
                                  setItemData({ ...itemData, sizes: { ...itemData.sizes, L: e.target.value } })
                                }
                              />
                              <input
                                type="number"
                                placeholder="Prix XL"
                                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                                  !itemData.sizes.XL && error ? "border-red-500" : ""
                                }`}
                                value={itemData.sizes.XL}
                                onChange={(e) =>
                                  setItemData({ ...itemData, sizes: { ...itemData.sizes, XL: e.target.value } })
                                }
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
                        {itemData.coverPreviews?.length > 0 && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Prévisualisation des images
                            </label>
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
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Jours de disponibilité</label>
                          <div className="flex flex-wrap gap-2">
                            {["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"].map((day) => (
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
                      <div className="mt-6">
                        <h2 className="text-2xl font-bold mb-6">Liste des plats</h2>
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
                  </div>
                )}
                {activeMenuSubSection === "extras" && (
                  <div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h2 className="text-2xl font-bold mb-6">Gestion des Extras</h2>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la liste d'extras *</label>
                          <input
                            type="text"
                            placeholder="Nom de la liste"
                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                              !extraListData.name && error ? "border-red-500" : ""
                            }`}
                            value={extraListData.name}
                            onChange={(e) => setExtraListData({ ...extraListData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Éléments de la liste</label>
                          {extraListData.extraListElements.map((element, index) => (
                            <div key={index} className="flex gap-2 mb-2">
                              <input
                                type="text"
                                placeholder="Nom de l'élément"
                                className="w-full p-2 border rounded-lg"
                                value={element.name}
                                onChange={(e) => updateExtraElement(index, "name", e.target.value)}
                              />
                              <input
                                type="number"
                                placeholder="Prix (FCFA)"
                                className="w-32 p-2 border rounded-lg"
                                value={element.price}
                                onChange={(e) => updateExtraElement(index, "price", e.target.value)}
                              />
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={element.required}
                                  onChange={(e) => updateExtraElement(index, "required", e.target.checked)}
                                  className="mr-1"
                                />
                                Requis
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={element.multiple}
                                  onChange={(e) => updateExtraElement(index, "multiple", e.target.checked)}
                                  className="mr-1"
                                />
                                Multiple
                              </label>
                              <button
                                className="text-red-600 hover:text-red-800"
                                onClick={() =>
                                  setExtraListData({
                                    ...extraListData,
                                    extraListElements: extraListData.extraListElements.filter((_, i) => i !== index),
                                  })
                                }
                              >
                                Supprimer
                              </button>
                            </div>
                          ))}
                          <button
                            className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                            onClick={addExtraElement}
                          >
                            Ajouter un élément
                          </button>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                          onClick={addExtraList}
                          disabled={!extraListData.name}
                        >
                          Créer la liste
                        </button>
                      </div>
                      <div className="mt-6">
                        <h2 className="text-2xl font-bold mb-6">Liste des Extras</h2>
                        {extraLists.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">Aucune liste d'extras ajoutée pour le moment</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {extraLists.map((extraList) => (
                              <div
                                key={extraList.id}
                                className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                              >
                                <h4 className="font-semibold text-gray-800">{extraList.name}</h4>
                                <p className="text-sm text-gray-600">Éléments: {extraList.extraListElements.length}</p>
                                <div className="text-sm text-gray-600 mt-2">
                                  {extraList.extraListElements.map((element, index) => (
                                    <p key={index}>
                                      {element.name} ({element.price ? `${formatPrice(element.price)} FCFA` : "Gratuit"})
                                      {element.required && " (Requis)"}
                                      {element.multiple && " (Multiple)"}
                                    </p>
                                  ))}
                                </div>
                                <div className="mt-3 flex justify-between">
                                  <button
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    onClick={() => {
                                      setExtraListData({
                                        name: extraList.name,
                                        extraListElements: extraList.extraListElements,
                                      });
                                      setEditingExtraList(extraList.id);
                                    }}
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    onClick={() => {
                                      if (window.confirm("Voulez-vous vraiment supprimer cette liste d'extras ?")) {
                                        deleteExtraList(extraList.id);
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
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "orders" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Gestion des Commandes</h2>
                <div className="flex flex-wrap gap-4 mb-4">
                 <button
                    className={`px-4 py-2 rounded-lg ${
                      activeOrderSubSection === "list" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                    } hover:bg-green-700 hover:text-white transition-colors`}
                    onClick={() => setActiveOrderSubSection("list")}
                  >
                    Liste des Commandes ({filteredOrders.length})
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      activeOrderSubSection === "create" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                    } hover:bg-green-700 hover:text-white transition-colors`}
                    onClick={() => setActiveOrderSubSection("create")}
                  >
                    Créer une Commande
                  </button>
                 {/* <button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                    onClick={() => setShowPendingModal(true)}
                  >
                    <FaShoppingBag className="mr-2" />
                    Commandes en attente ({pendingOrders.length})
                  </button> */}
                </div>
                {error && <p className="text-red-600 mb-4">{error}</p>}
                {activeOrderSubSection === "list" && (
                  <div>
                    <div className="flex flex-wrap gap-4 mb-4">
                      <button
                        className={`px-4 py-2 rounded-lg ${
                          viewMode === "kanban" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                        } hover:bg-green-700 hover:text-white transition-colors`}
                        onClick={() => setViewMode("kanban")}
                      >
                        Vue Kanban
                      </button>
                      <button
                        className={`px-4 py-2 rounded-lg ${
                          viewMode === "list" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                        } hover:bg-green-700 hover:text-white transition-colors`}
                        onClick={() => setViewMode("list")}
                      >
                        Vue Liste
                      </button>
                    </div>
                    {viewMode === "kanban" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(STATUS_LABELS).map(([status, label]) => (
                          status !== ORDER_STATUS.FAILED && (
                            <div
                              key={status}
                              className={`border p-4 rounded-lg min-h-[200px] ${STATUS_COLUMN_COLORS[status]}`}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, status)}
                            >
                              <h3 className="text-lg font-semibold mb-3">{label}</h3>
                              <div className="space-y-3">
                                {filteredOrders
                                  .filter((order) => order.status === status)
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
                          )
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredOrders.map((order) => (
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
                    )}
                  </div>
                )}
                {activeOrderSubSection === "create" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6">Créer une nouvelle commande</h2>
                    <CreateOrderForm
                      items={items}
                      extraLists={extraLists}
                      restaurantId={currentRestaurantId}
                      deliveryFees={deliveryFees}
                      getDeliveryFee={getDeliveryFee}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "categories" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Gestion des Catégories</h2>
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

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Liste des Catégories</h2>
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
                            {category.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>
                            )}
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

          {activeSection === "loyalty" && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Gestion des Points de Fidélité</h2>
              <LoyaltyPointsManager restaurantId={currentRestaurantId} />
            </div>
          )}

          {activeSection === "comments" && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Avis Clients</h2>
              {feedbacks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucun avis pour le moment</p>
              ) : (
                <div className="space-y-4">
                  {feedbacks.map((feedback) => (
                    <div
                      key={feedback.id}
                      className="p-4 border rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <FaStar className="text-yellow-400" />
                          <span className="font-semibold">{feedback.rating.rating}/5</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {feedback.timestamp ? new Date(feedback.timestamp.seconds * 1000).toLocaleString("fr-FR") : "Date inconnue"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{feedback.comment}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Par: {usersData.byId[feedback.userId]?.email || "Utilisateur inconnu"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

          {showPendingModal && (
            <PendingOrdersModal
              orders={pendingOrders}
              items={items}
              extraLists={extraLists}
              usersData={usersData}
              onClose={() => setShowPendingModal(false)}
            />
          )}
        </div>
      </main>
    </div>
  </div>
);
};

export default RestaurantAdmin;