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
  const [assignedDeliverer, setAssignedDeliverer] = useState(order.assignedDeliverer || "");

  // Liste des livreurs disponibles
  const DELIVERERS = ["Boris", "Cyriac", "Serge", "Ismaël", "Joël", "Patrick", "Abdoulaye"];

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

export default OrderDetailsModal;
