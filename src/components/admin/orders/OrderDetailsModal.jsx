import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Timestamp, collection, doc, onSnapshot, query, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import {
  ORDER_STATUS,
  STATUS_LABELS,
  STATUS_COLORS,
  DEFAULT_DELIVERY_FEE,
  FAILURE_REASONS,
} from "../adminConstants";
import {
  formatPrice,
  convertPrice,
  calculateTimeDifferenceInMinutes,
  calculateOrderTotals,
} from "../../../utils/adminUtils";
import { groupExtrasByGroupId, validateRequiredGroups } from "../../../shared/extras";

const OrderDetailsModal = React.memo(({ 
  order, 
  items, 
  extraLists, 
  usersData, 
  onClose, 
  onUpdateFees, 
  onDelete, 
  onUpdateStatus,
  onOrderUpdated
}) => {
  // Vérification de sécurité pour éviter les erreurs si usersData n'est pas encore chargé
  const safeUsersData = usersData || { byId: {}, byPhone: {} };
  
  const [restaurants, setRestaurants] = useState([]);
  
  // Charger les restaurants au montage
  useEffect(() => {
    const loadRestaurants = async () => {
      try {
        const restaurantsSnap = await getDocs(collection(db, 'restaurants'));
        const restaurantsData = restaurantsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRestaurants(restaurantsData);
      } catch (error) {
        console.error('Erreur chargement restaurants:', error);
      }
    };
    loadRestaurants();
  }, []);
  
  const user = order.userId
    ? safeUsersData.byId?.[order.userId]
    : order.contact?.phone && safeUsersData.byPhone?.[order.contact.phone];
  const clientInfo = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Utilisateur inconnu"
    : order.contact?.name || "Client inconnu";
  const restaurant = restaurants.find(r => r.id === order.restaurantId);
  const restaurantName = restaurant ? restaurant.name : (restaurants.length === 0 ? "Chargement..." : "Restaurant inconnu");
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
  const [assignedDeliverer, setAssignedDeliverer] = useState(order.assignedDeliverer || "");
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [showTotalModal, setShowTotalModal] = useState(false);
  const [customDiscount, setCustomDiscount] = useState(order.customDiscount || 0);
  const [customTotal, setCustomTotal] = useState(null);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(order.payment?.method || 'cash');
  const [paymentProvider, setPaymentProvider] = useState(order.payment?.provider || 'OM');
  const [transactionId, setTransactionId] = useState(order.payment?.transactionId || '');
  const [paymentSplit, setPaymentSplit] = useState({
    cash: order.payment?.cashAmount || 0,
    mobile: order.payment?.mobileAmount || 0,
    method: order.paymentMethod?.id || "cash_delivery"
  });
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Liste des livreurs disponibles
  const DELIVERERS = ["Boris", "Cyriac", "Serge", "Ismaël", "Joël", "Patrick", "Abdoulaye", "Franck"];

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
    const calculated = calculateOrderTotals({ ...order, items: editedItems }, extraLists, items);
    
    // Appliquer réduction personnalisée ou total personnalisé
    if (customTotal !== null && customTotal >= 0) {
      return { ...calculated, totalWithDelivery: customTotal };
    } else if (customDiscount > 0) {
      return { ...calculated, totalWithDelivery: Math.max(0, calculated.totalWithDelivery - customDiscount) };
    }
    
    return calculated;
  }, [order, editedItems, extraLists, items, customDiscount, customTotal]);

  // Recharger les données après une mise à jour
  useEffect(() => {
    if (refreshTrigger > 0) {
      // Forcer le rechargement des données en mettant à jour l'état local
      const updatedOrder = { ...order };
      setPaymentMethod(updatedOrder.payment?.method || 'cash');
      setPaymentProvider(updatedOrder.payment?.provider || 'OM');
      setTransactionId(updatedOrder.payment?.transactionId || '');
      setPaymentSplit({
        cash: updatedOrder.payment?.cashAmount || 0,
        mobile: updatedOrder.payment?.mobileAmount || 0,
        provider: updatedOrder.payment?.provider || 'OM',
        method: updatedOrder.paymentMethod?.id || "cash_delivery"
      });
    }
  }, [refreshTrigger, order]);

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

  const handlePriceChange = (index, newPrice) => {
    setEditedItems(prev => {
      const updatedItems = [...prev];
      updatedItems[index] = { ...updatedItems[index], price: Math.max(0, Number(newPrice) || 0) };
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
      // Validation centralisée des extras requis
      if (extraLists && extraLists.length > 0) {
        const allExtras = [];
        extraLists.forEach((list) => {
          (list.extraListElements || []).forEach((el, i) => {
            allExtras.push({
              id: `${list.id}:${i}`,
              name: el.name,
              price: el.price,
              groupId: list.id,
              required: Boolean(el.required || list.required),
            });
          });
        });
        const groups = groupExtrasByGroupId(allExtras);
        const selectedById = {};
        Object.entries(item.selectedExtras || {}).forEach(([gid, idxs = []]) => {
          idxs.forEach((i) => { selectedById[`${gid}:${i}`] = true; });
        });
        const res = validateRequiredGroups({ groups, selectedById });
        if (!res.valid) {
          const firstErr = res.errors[0];
          const list = extraLists.find((l) => (l.id === firstErr.groupId) || (firstErr.groupId === "__ungrouped__" && l.id));
          const name = list?.name || "Extras";
          return `Extras obligatoires manquants pour ${name}`;
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

  // Fonction pour assigner un livreur
  const handleAssignDeliverer = async () => {
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        assignedDeliverer: assignedDeliverer,
        updatedAt: Timestamp.now(),
      });
      setSuccessMessage(`Livreur ${assignedDeliverer} assigné avec succès`);
    } catch (error) {
      console.error("Erreur lors de l'assignation du livreur:", error);
      setError("Erreur lors de l'assignation du livreur");
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

  // Gestion du total personnalisé
  const handleOpenTotalModal = () => {
    setShowTotalModal(true);
    setCustomDiscount(order.customDiscount || 0);
    setCustomTotal(order.customTotal || null);
    setPaymentSplit({
      cash: order.cashAmount || 0,
      mobile: order.mobileAmount || 0,
      method: order.paymentMethod?.id || "cash_delivery"
    });
  };

  const handleSaveTotal = async () => {
    try {
      const orderRef = doc(db, "orders", order.id);
      const updateData = {
        customDiscount: Number(customDiscount) || 0,
        customTotal: customTotal !== null ? Number(customTotal) : null,
        cashAmount: Number(paymentSplit.cash) || 0,
        mobileAmount: Number(paymentSplit.mobile) || 0,
        updatedAt: Timestamp.now(),
      };

      // Vérifier si paiement mixte
      if (paymentSplit.cash > 0 && paymentSplit.mobile > 0) {
        updateData.paymentMethod = { id: "mixed", name: "Paiement Mixte (Cash + Mobile)" };
      }

      await updateDoc(orderRef, updateData);
      setSuccessMessage("Total et paiement mis à jour avec succès");
      
      // Notifier le composant parent de la mise à jour
      if (onOrderUpdated) {
        const updatedOrder = { ...order, ...updateData };
        onOrderUpdated(updatedOrder);
      }
      
      setTimeout(() => setShowTotalModal(false), 1000);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du total:", error);
      setError("Erreur lors de la sauvegarde du total");
    }
  };

  const handleCancelTotalEdit = () => {
    setShowTotalModal(false);
    setCustomDiscount(order.customDiscount || 0);
    setCustomTotal(order.customTotal || null);
  };

  // Gestion de la modification du paiement
  const handleEditPayment = () => {
    setIsEditingPayment(true);
    setPaymentMethod(order.payment?.method || 'cash');
    setPaymentProvider(order.payment?.provider || 'OM');
    setTransactionId(order.payment?.transactionId || '');
    setPaymentSplit({
      cash: order.payment?.cashAmount || 0,
      mobile: order.payment?.mobileAmount || 0,
      provider: order.payment?.provider || 'OM', // Initialiser avec la valeur sauvegardée
      method: order.paymentMethod?.id || "cash_delivery"
    });
    setPaymentError(null);
    setPaymentSuccessMessage(null);
  };

  const handleSavePayment = async () => {
    setIsSavingPayment(true);
    setPaymentError(null);
    
    // Validation pour les paiements mixtes
    if (paymentMethod === 'mixed') {
      const mixedTotal = paymentSplit.cash + paymentSplit.mobile;
      if (mixedTotal !== totalWithDelivery) {
        setPaymentError(`Le total du paiement mixte (${formatPrice(mixedTotal)} FCFA) ne correspond pas au total de la commande (${formatPrice(totalWithDelivery)} FCFA). Différence: ${formatPrice(mixedTotal - totalWithDelivery)} FCFA.`);
        setIsSavingPayment(false);
        return;
      }
    }
    
    try {
      const paymentData = {
        method: paymentMethod,
        status: 'paid',
        paidAt: Timestamp.now(),
      };
      
      console.log('💾 SAUVEGARDE PAIEMENT:', {
        orderId: order.id,
        paymentMethod,
        paymentProvider,
        paymentData
      });

      if (paymentMethod === 'mobile_money') {
        paymentData.provider = paymentProvider;
        paymentData.transactionId = transactionId;
      } else if (paymentMethod === 'mixed') {
        paymentData.method = 'mixed';
        paymentData.cashAmount = paymentSplit.cash;
        paymentData.mobileAmount = paymentSplit.mobile;
        paymentData.provider = paymentSplit.provider || 'OM';
        paymentData.transactionId = transactionId;
      }

      const orderRef = doc(db, "orders", order.id);
      
      // Mettre à jour aussi l'ancien champ paymentMethod pour compatibilité
      let paymentMethodUpdate = {};
      if (paymentMethod === 'mobile_money') {
        paymentMethodUpdate.paymentMethod = paymentProvider === 'OM' ? 'Orange Money' : 'MTN Mobile Money';
      } else if (paymentMethod === 'cash') {
        paymentMethodUpdate.paymentMethod = 'Cash';
      } else if (paymentMethod === 'bank_transfer') {
        paymentMethodUpdate.paymentMethod = 'Bank Transfer';
      } else if (paymentMethod === 'mixed') {
        paymentMethodUpdate.paymentMethod = 'Mixed Payment';
      }
      
      await updateDoc(orderRef, {
        payment: paymentData,
        isPaid: true, // Marquer la commande comme payée
        updatedAt: Timestamp.now(),
        ...paymentMethodUpdate // Mettre à jour l'ancien champ aussi
      });
      
      console.log('✅ PAIEMENT SAUVEGARDÉ:', {
        orderId: order.id,
        payment: paymentData,
        isPaid: true
      });
      
      setPaymentSuccessMessage("Paiement mis à jour avec succès");
      setRefreshTrigger(prev => prev + 1); // Déclencher un rafraîchissement
      
      // Notifier le composant parent de la mise à jour
      if (onOrderUpdated) {
        const updatedOrder = { ...order, payment: paymentData, isPaid: true };
        onOrderUpdated(updatedOrder);
      }
      
      setTimeout(() => setIsEditingPayment(false), 1000);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du paiement:", error);
      setPaymentError("Erreur lors de la sauvegarde du paiement");
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleCancelPaymentEdit = () => {
    setIsEditingPayment(false);
    setPaymentMethod(order.payment?.method || 'cash');
    setPaymentProvider(order.payment?.provider || 'OM');
    setTransactionId(order.payment?.transactionId || '');
    setPaymentSplit({
      cash: order.payment?.cashAmount || 0,
      mobile: order.payment?.mobileAmount || 0,
      provider: order.payment?.provider || 'OM', // Réinitialiser avec la valeur sauvegardée
      method: order.paymentMethod?.id || "cash_delivery"
    });
    setPaymentError(null);
    setPaymentSuccessMessage(null);
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
              <div className="flex justify-between items-center mb-1">
                <h6 className="font-bold text-xs text-gray-800">Paiement & Restaurant</h6>
                {!isEditingPayment && (
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={handleEditPayment}
                  >
                    Modifier
                  </button>
                )}
              </div>
              {paymentError && <p className="text-red-600 text-xs mb-2">{paymentError}</p>}
              {paymentSuccessMessage && <p className="text-green-600 text-xs mb-2">{paymentSuccessMessage}</p>}
              <div className="text-xs text-gray-700 space-y-0.5">
                {isEditingPayment ? (
                  <div className="space-y-2">
                    {/* Sélection du moyen de paiement */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Moyen de paiement</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full border rounded text-xs p-1"
                      >
                        <option value="cash">Espèces</option>
                        <option value="mobile_money">Mobile Money</option>
                        <option value="bank_transfer">Virement</option>
                        <option value="mixed">Paiement Mixte (Cash + Mobile)</option>
                      </select>
                    </div>

                    {/* Détails selon le moyen de paiement */}
                    {paymentMethod === 'mobile_money' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Opérateur</label>
                          <select
                            value={paymentProvider}
                            onChange={(e) => setPaymentProvider(e.target.value)}
                            className="w-full border rounded text-xs p-1"
                          >
                            <option value="OM">OM</option>
                            <option value="MOMO">MTN</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ID Transaction</label>
                          <input
                            type="text"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="Ex: MP240101.1234.A12345"
                            className="w-full border rounded text-xs p-1"
                          />
                        </div>
                      </div>
                    )}

                    {/* Paiement Mixte */}
                    {paymentMethod === 'mixed' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Montant Cash (FCFA)</label>
                            <input
                              type="number"
                              value={paymentSplit.cash || ""}
                              onChange={(e) => {
                                const newCash = Math.max(0, Number(e.target.value) || 0);
                                const remaining = Math.max(0, totalWithDelivery - newCash);
                                setPaymentSplit(prev => ({ ...prev, cash: newCash, mobile: remaining }));
                              }}
                              className="w-full border rounded text-xs p-1"
                              min="0"
                              step="100"
                              placeholder="Saisir montant cash"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Montant Mobile (FCFA)</label>
                            <input
                              type="number"
                              value={paymentSplit.mobile || ""}
                              onChange={(e) => {
                                const newMobile = Math.max(0, Number(e.target.value) || 0);
                                const remaining = Math.max(0, totalWithDelivery - newMobile);
                                setPaymentSplit(prev => ({ ...prev, mobile: newMobile, cash: remaining }));
                              }}
                              className="w-full border rounded text-xs p-1"
                              min="0"
                              step="100"
                              placeholder="Calculé automatiquement"
                            />
                          </div>
                        </div>
                        <div className="flex justify-center mt-2">
                          <button
                            onClick={() => {
                              const half = Math.floor(totalWithDelivery / 2);
                              setPaymentSplit(prev => ({ ...prev, cash: half, mobile: totalWithDelivery - half }));
                            }}
                            className="text-blue-600 hover:text-blue-800 underline text-xs"
                          >
                            Répartition 50/50
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Opérateur Mobile</label>
                          <select
                            value={paymentProvider}
                            onChange={(e) => setPaymentProvider(e.target.value)}
                            className="w-full border rounded text-xs p-1"
                          >
                            <option value="OM">OM</option>
                            <option value="MOMO">MTN</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">ID Transaction Mobile</label>
                          <input
                            type="text"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="Ex: MP240101.1234.A12345"
                            className="w-full border rounded text-xs p-1"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">Total mixte: {formatPrice(paymentSplit.cash + paymentSplit.mobile)} FCFA</span>
                          {(paymentSplit.cash + paymentSplit.mobile) !== totalWithDelivery && (
                            <button
                              onClick={() => {
                                // Rééquilibrer automatiquement
                                const currentTotal = paymentSplit.cash + paymentSplit.mobile;
                                if (currentTotal < totalWithDelivery) {
                                  // Ajouter la différence au mobile
                                  setPaymentSplit(prev => ({ 
                                    ...prev, 
                                    mobile: prev.mobile + (totalWithDelivery - currentTotal) 
                                  }));
                                } else {
                                  // Réduire le mobile
                                  setPaymentSplit(prev => ({ 
                                    ...prev, 
                                    mobile: Math.max(0, prev.mobile - (currentTotal - totalWithDelivery)) 
                                  }));
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 underline text-xs"
                            >
                              Équilibrer
                            </button>
                          )}
                        </div>
                        <div className="text-xs">
                          {(paymentSplit.cash + paymentSplit.mobile) !== totalWithDelivery && (
                            <span className="text-red-600">
                              (Différence: {formatPrice((paymentSplit.cash + paymentSplit.mobile) - totalWithDelivery)} FCFA)
                            </span>
                          )}
                          {(paymentSplit.cash + paymentSplit.mobile) === totalWithDelivery && (
                            <span className="text-green-600">✓ Total équilibré</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Boutons d'action */}
                    <div className="flex gap-2 mt-2">
                      <button
                        className="flex-1 bg-blue-600 text-white p-1 rounded hover:bg-blue-700 text-xs disabled:bg-blue-300"
                        onClick={handleSavePayment}
                        disabled={isSavingPayment}
                      >
                        {isSavingPayment ? "Enregistrement..." : "Enregistrer"}
                      </button>
                      <button
                        className="flex-1 bg-gray-200 p-1 rounded hover:bg-gray-300 text-xs"
                        onClick={handleCancelPaymentEdit}
                        disabled={isSavingPayment}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center">
                      <i className={`${order.paymentMethod?.icon || "fa fa-credit-card"} text-green-600 text-sm mr-1`}></i>
                      <span>{order.payment?.method === 'cash' ? 'Espèces' :
                             order.payment?.method === 'mobile_money' ? 'Mobile Money' :
                             order.payment?.method === 'bank_transfer' ? 'Virement' :
                             order.payment?.method === 'mixed' ? 'Paiement Mixte (Cash + Mobile)' :
                             order.paymentMethod?.name || "Non spécifié"}</span>
                    </div>
                    {order.payment?.method === 'mobile_money' && (
                      <div className="text-xs text-gray-600 ml-4">
                        <div>Opérateur: {order.payment.provider === 'OM' ? 'OM' : 
                                        order.payment.provider === 'MOMO' ? 'MTN' : 
                                        order.payment.provider}</div>
                        {order.payment.transactionId && (
                          <div>ID: {order.payment.transactionId}</div>
                        )}
                      </div>
                    )}
                    {order.payment?.method === 'mixed' && (
                      <div className="text-xs text-gray-600 ml-4">
                        <div>Cash: {formatPrice(order.payment.cashAmount || 0)} FCFA</div>
                        <div>Mobile: {formatPrice(order.payment.mobileAmount || 0)} FCFA</div>
                        <div>Opérateur: {order.payment.provider === 'OM' ? 'OM' : 
                                        order.payment.provider === 'MOMO' ? 'MTN' : 
                                        order.payment.provider}</div>
                        {order.payment.transactionId && (
                          <div>ID: {order.payment.transactionId}</div>
                        )}
                      </div>
                    )}
                    <p><span className="font-medium">Restaurant :</span> {restaurantName}</p>
                  </>
                )}
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
                            <div className="flex items-center space-x-1">
                              <label className="text-xs text-gray-600">Prix:</label>
                              <input
                                type="number"
                                value={item.price || 0}
                                onChange={(e) => handlePriceChange(index, e.target.value)}
                                className="w-20 border rounded text-xs p-1"
                                min="0"
                                step="100"
                              />
                              <span className="text-xs text-gray-600">FCFA</span>
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
                {customDiscount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Réduction :</span>
                    <span>-{formatPrice(customDiscount)} FCFA</span>
                  </div>
                )}
                {customTotal !== null && (
                  <div className="flex justify-between text-blue-600">
                    <span>Total personnalisé :</span>
                    <span>{formatPrice(customTotal)} FCFA</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-green-600">
                  <span>Total :</span>
                  <span>{formatPrice(totalWithDelivery)} FCFA</span>
                </div>
                {((order.cashAmount || 0) > 0 || (order.mobileAmount || 0) > 0 || order.payment?.method === 'mixed') && (
                  <div className="mt-2 pt-2 border-t text-xs">
                    <div className="text-gray-600 font-medium mb-1">Répartition paiement :</div>
                    {order.payment?.method === 'mixed' ? (
                      <>
                        <div className="flex justify-between">
                          <span>Cash :</span>
                          <span>{formatPrice(order.payment.cashAmount || 0)} FCFA</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Mobile :</span>
                          <span>{formatPrice(order.payment.mobileAmount || 0)} FCFA</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {(order.cashAmount || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Cash :</span>
                            <span>{formatPrice(order.cashAmount)} FCFA</span>
                          </div>
                        )}
                        {(order.mobileAmount || 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Mobile :</span>
                            <span>{formatPrice(order.mobileAmount)} FCFA</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
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
            
            <div className="space-y-1">
              <label className="block font-bold text-xs">Livreur assigné :</label>
              <select
                className="w-full p-1 border rounded text-xs"
                value={assignedDeliverer}
                onChange={(e) => setAssignedDeliverer(e.target.value)}
              >
                <option value="">Aucun livreur assigné</option>
                {DELIVERERS.map((deliverer) => (
                  <option key={deliverer} value={deliverer}>{deliverer}</option>
                ))}
              </select>
              <button 
                className="w-full bg-green-600 text-white p-1 rounded hover:bg-green-700 text-xs" 
                onClick={handleAssignDeliverer}
                disabled={!assignedDeliverer}
              >
                Assigner livreur
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
            className="flex-1 bg-blue-500 text-white p-1 rounded hover:bg-blue-600 text-xs"
            onClick={handleOpenTotalModal}
          >
            Modifier total
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
        {showTotalModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-md">
              <h4 className="text-lg font-semibold mb-3">Modifier le total et paiement</h4>
              
              <div className="space-y-4">
                {/* Réduction */}
                <div>
                  <label className="block text-sm font-medium mb-1">Réduction (FCFA)</label>
                  <input
                    type="number"
                    value={customDiscount}
                    onChange={(e) => setCustomDiscount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full p-2 border rounded text-sm"
                    min="0"
                    step="100"
                    placeholder="0"
                  />
                </div>

                {/* Total personnalisé */}
                <div>
                  <label className="block text-sm font-medium mb-1">Total personnalisé (FCFA)</label>
                  <input
                    type="number"
                    value={customTotal || ""}
                    onChange={(e) => setCustomTotal(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
                    className="w-full p-2 border rounded text-sm"
                    min="0"
                    step="100"
                    placeholder="Laisser vide pour calcul automatique"
                  />
                  <p className="text-xs text-gray-500 mt-1">Remplace le total calculé</p>
                </div>

                {/* Paiement mixte */}
                <div className="border-t pt-3">
                  <h5 className="font-medium mb-2">Répartition paiement</h5>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-sm mb-1">Cash (FCFA)</label>
                      <input
                        type="number"
                        value={paymentSplit.cash}
                        onChange={(e) => setPaymentSplit(prev => ({ ...prev, cash: Math.max(0, Number(e.target.value) || 0) }))}
                        className="w-full p-2 border rounded text-sm"
                        min="0"
                        step="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Mobile (FCFA)</label>
                      <input
                        type="number"
                        value={paymentSplit.mobile}
                        onChange={(e) => setPaymentSplit(prev => ({ ...prev, mobile: Math.max(0, Number(e.target.value) || 0) }))}
                        className="w-full p-2 border rounded text-sm"
                        min="0"
                        step="100"
                      />
                    </div>
                  </div>
                  
                  {/* Sélection de l'opérateur mobile */}
                  {paymentSplit.mobile > 0 && (
                    <div className="mb-2">
                      <label className="block text-sm mb-1">Opérateur Mobile</label>
                      <select
                        value={paymentSplit.provider || 'OM'}
                        onChange={(e) => {
                          const newProvider = e.target.value;
                          setPaymentSplit(prev => ({ ...prev, provider: newProvider }));
                          setPaymentProvider(newProvider); // Synchroniser avec paymentProvider
                        }}
                        className="w-full p-2 border rounded text-sm"
                      >
                        <option value="OM">🟠 Orange Money (OM)</option>
                        <option value="MOMO">🟡 MTN Mobile Money (MOMO)</option>
                      </select>
                    </div>
                  )}
                  
                  <div className="mt-2 text-xs text-gray-600">
                    <div>Total réparti: {formatPrice(paymentSplit.cash + paymentSplit.mobile)} FCFA</div>
                    {paymentSplit.mobile > 0 && (
                      <div className="mt-1">
                        <span className="font-medium">Détail:</span> 
                        <span className="ml-1">{formatPrice(paymentSplit.cash)} FCFA Cash</span>
                        <span className="ml-1">•</span> 
                        <span className="ml-1">{formatPrice(paymentSplit.mobile)} FCFA {paymentSplit.provider === 'OM' ? 'OM' : 'MTN MOMO'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Aperçu */}
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium mb-2">Aperçu</div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Sous-total + frais:</span>
                      <span>{formatPrice(subtotal + (order.deliveryFee || 0))} FCFA</span>
                    </div>
                    {customDiscount > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Réduction:</span>
                        <span>-{formatPrice(customDiscount)} FCFA</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-green-600 border-t pt-1">
                      <span>Total final:</span>
                      <span>{formatPrice(customTotal !== null ? customTotal : Math.max(0, subtotal + (order.deliveryFee || 0) - customDiscount))} FCFA</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  className="flex-1 bg-gray-200 p-2 rounded hover:bg-gray-300 text-sm"
                  onClick={handleCancelTotalEdit}
                >
                  Annuler
                </button>
                <button
                  className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-sm"
                  onClick={handleSaveTotal}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default OrderDetailsModal;
