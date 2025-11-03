import React, { useState } from "react";
import { doc, updateDoc, Timestamp, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  DEFAULT_DELIVERY_FEE,
} from "../adminConstants";
import { calculateOrderTotals, convertPrice, getDisplayTotal } from "../../../utils/adminUtils";
import { FaTruck, FaCheck } from "react-icons/fa";

const OrderCard = ({ order, items, extraLists, usersData, onShowDetails, onDragStart, onDragEnd, deliverers = [] }) => {
  const [isAssigning, setIsAssigning] = useState(false);
  // Vérification de sécurité pour éviter les erreurs si usersData n'est pas encore chargé
  const safeUsersData = usersData || { byId: {}, byPhone: {} };
  
  const user = order.userId
    ? safeUsersData.byId?.[order.userId]
    : order.contact?.phone && safeUsersData.byPhone?.[order.contact.phone];
  const clientInfo = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Utilisateur inconnu"
    : order.contact?.name || "Client inconnu";
  const phoneNumber = user?.phone || order.address?.phone || order.contact?.phone || "Non spécifié";
  const address = order.address || {};
  const quartier = address.area || "Non spécifié";
  const description = address.completeAddress || "Non spécifié";
  const deliveryFee = order.deliveryFee !== undefined ? Number(order.deliveryFee) : DEFAULT_DELIVERY_FEE;
  const totals = calculateOrderTotals(order, extraLists, items);
  const displayTotal = getDisplayTotal(order, totals);
  const { subtotal } = totals;

  const getExtraName = (extraListId, index) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    const element = extraList?.extraListElements?.[index];
    return element ? `${element.name}${element.price ? ` (+${convertPrice(element.price).toLocaleString()} FCFA)` : ""}` : "Extra inconnu";
  };

  const handleQuickAssign = async (e, delivererName) => {
    e.stopPropagation();
    if (!delivererName || delivererName === order.assignedDeliverer) return;
    
    setIsAssigning(true);
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        assignedDeliverer: delivererName,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Erreur lors de l'assignation:", error);
    } finally {
      setIsAssigning(false);
    }
  };

  // Filtrer les livreurs actifs
  const activeDeliverers = deliverers.filter(d => d.active);

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
        <div className="text-gray-600">Frais de livraison: {deliveryFee.toLocaleString()} FCFA</div>

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
            <span>{subtotal.toLocaleString()} FCFA</span>
          </div>
          <div className="flex justify-between">
            <span>Frais:</span>
            <span>{deliveryFee.toLocaleString()} FCFA</span>
          </div>
          <div className="flex justify-between">
            <span>Prix reduit:</span>
            <span className="text-red-600">
              {(Number(order.pointsReduction) || 0).toLocaleString()} FCFA
            </span>
          </div>
          {(order.customDiscount > 0 || order.customTotal !== null) && (
            <div className="flex justify-between text-orange-600">
              <span>Réduction:</span>
              <span>-{(order.customDiscount || 0).toLocaleString()} FCFA</span>
            </div>
          )}
          <div className="flex justify-between text-green-600 font-semibold">
            <span>Total:</span>
            <span>{displayTotal.toLocaleString()} FCFA</span>
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

        {/* Sélecteur rapide de livreur */}
        {activeDeliverers.length > 0 && (
          <div className="border-t pt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <FaTruck className="text-blue-500" />
              <select
                value={order.assignedDeliverer || ""}
                onChange={(e) => handleQuickAssign(e, e.target.value)}
                disabled={isAssigning}
                className={`flex-1 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 ${
                  order.assignedDeliverer && order.assignedDeliverer !== "Non assigné"
                    ? "bg-green-50 border-green-500 text-green-700 font-medium"
                    : "bg-gray-50 border-gray-300"
                } ${isAssigning ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <option value="">-- Assigner un livreur --</option>
                {activeDeliverers.map((deliverer) => (
                  <option key={deliverer.id} value={deliverer.name}>
                    {deliverer.name} {deliverer.zone ? `(${deliverer.zone})` : ""}
                  </option>
                ))}
              </select>
              {order.assignedDeliverer && order.assignedDeliverer !== "Non assigné" && (
                <FaCheck className="text-green-500" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
