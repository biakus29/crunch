import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import MtnLogo from "../image/Mtn-logo-svg.svg.png";
import OrangeLogo from "../image/orange logo.png";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import ThankYouPage from "./thankyou";

// --- Utils ---
const convertPrice = (price) => {
  if (!price && price !== 0) return 0;
  try {
    return typeof price === "string" ? parseFloat(price.replace(/\./g, "")) || 0 : Number(price) || 0;
  } catch {
    return 0;
  }
};

const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// Loyalty constants
const LOYALTY_THRESHOLD = 5000;
const NORMAL_RATE = 0.05;
const CREDIT_PER_POINT = 100;

// Order status constants (from ordertrack.jsx)
const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  READY_TO_DELIVER: "pret_a_livrer",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  CANCELLED: "annulee",
  FAILED: "echec",
};

const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "En attente",
  [ORDER_STATUS.PREPARING]: "En préparation",
  [ORDER_STATUS.DELIVERING]: "En livraison",
  [ORDER_STATUS.DELIVERED]: "Livrée",
  [ORDER_STATUS.CANCELLED]: "Annulée",
  [ORDER_STATUS.FAILED]: "Échec",
};

const STATUS_COMMENTS = {
  [ORDER_STATUS.PENDING]: "Commande en attente d’être validée",
  [ORDER_STATUS.PREPARING]: "Un livreur vous appelera dès que votre commande sera prête",
  [ORDER_STATUS.DELIVERING]: "Commande en route pour la livraison",
  [ORDER_STATUS.DELIVERED]: "Commande livrée avec succès",
  [ORDER_STATUS.CANCELLED]: "Commande annulée",
  [ORDER_STATUS.FAILED]: "La livraison a échoué (contactez le support)",
};

const CompleteOrderPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  const [extraListsMap, setExtraListsMap] = useState({});
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        if (!orderId) {
          setError("Identifiant de commande manquant.");
          setLoading(false);
          return;
        }
        const [orderSnap, itemsSnap, extrasSnap] = await Promise.all([
          getDoc(doc(db, "orders", orderId)),
          getDocs(collection(db, "items")),
          getDocs(collection(db, "extraLists")),
        ]);
        if (!orderSnap.exists()) {
          setError("Commande introuvable.");
          setLoading(false);
          return;
        }
        setOrder({ id: orderSnap.id, ...orderSnap.data() });
        setItemsMap(itemsSnap.docs.reduce((acc, d) => ({ ...acc, [d.id]: d.data() }), {}));
        setExtraListsMap(extrasSnap.docs.reduce((acc, d) => ({ ...acc, [d.id]: d.data() }), {}));
      } catch (e) {
        setError(e.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId]);

  // Build steps for tracking timeline (from ordertrack.jsx)
  const getSteps = useCallback((order) => {
    if (!order) return [];
    const statuses = [
      { id: "pending", title: STATUS_LABELS[ORDER_STATUS.PENDING], status: ORDER_STATUS.PENDING },
      { id: "preparing", title: STATUS_LABELS[ORDER_STATUS.PREPARING], status: ORDER_STATUS.PREPARING },
      { id: "delivering", title: STATUS_LABELS[ORDER_STATUS.DELIVERING], status: ORDER_STATUS.DELIVERING },
      { id: "delivered", title: STATUS_LABELS[ORDER_STATUS.DELIVERED], status: ORDER_STATUS.DELIVERED },
    ];
    const currentIndex = statuses.findIndex((s) => s.status === order.status);
    return statuses.map((step, index) => ({
      ...step,
      stepStatus: index <= currentIndex ? "completed" : "pending",
      description: STATUS_COMMENTS[step.status],
      timestamp: index <= currentIndex && order.timestamp
        ? new Date(order.timestamp.seconds * 1000).toISOString()
        : null,
    }));
  }, []);

  // Allow customer to confirm delivery (like in ordertrack.jsx)
  const confirmDelivery = useCallback(async () => {
    try {
      if (!order?.id) return;
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        status: ORDER_STATUS.DELIVERED,
        updatedAt: new Date(),
      });
      setOrder((prev) => prev ? { ...prev, status: ORDER_STATUS.DELIVERED, updatedAt: new Date() } : prev);
    } catch (err) {
      console.error("Erreur lors de la confirmation de livraison:", err);
      setError("Échec de la confirmation. Réessayez.");
    }
  }, [order]);

  const itemsTotal = useMemo(() => {
    if (!order?.items) return 0;
    return order.items.reduce((sum, it) => {
      const itemData = itemsMap[it.dishId] || {};
      const isSizeBased = itemData?.priceType === "sizes" && it.size && itemData?.sizes?.[it.size] !== undefined;
      let base = 0;
      if (it.price !== undefined && !isNaN(convertPrice(it.price))) base = convertPrice(it.price);
      else if (it.dishPrice !== undefined && !isNaN(convertPrice(it.dishPrice))) base = convertPrice(it.dishPrice);
      else if (isSizeBased) base = convertPrice(itemData.sizes[it.size]);
      else base = convertPrice(itemData.price || 0);

      // Prefer stored extras prices if present on the order item; otherwise compute from catalogs
      const extras = it.selectedExtras
        ? Object.entries(it.selectedExtras).reduce((acc, [listId, idxs]) => {
            const list = extraListsMap[listId]?.extraListElements || [];
            const sumIdx = idxs.reduce((s, i) => s + convertPrice(list[i]?.price || 0), 0);
            return acc + sumIdx;
          }, 0)
        : Array.isArray(it.extras)
        ? it.extras.reduce((acc, ex) => acc + convertPrice(ex?.price || 0), 0)
        : 0;

      return sum + (base + extras) * Number(it.quantity || 1);
    }, 0);
  }, [order, itemsMap, extraListsMap]);

  const deliveryFee = useMemo(() => convertPrice(order?.deliveryFee) || 0, [order]);
  const total = useMemo(() => Math.max(0, itemsTotal + deliveryFee - convertPrice(order?.pointsReduction || 0)), [itemsTotal, deliveryFee, order]);

  // Infos client
  const phoneNumber = order?.contact?.phone || order?.address?.phone || "";
  const deliveryArea = order?.address?.area || "";
  const deliveryAddress = order?.address?.completeAddress || "";
  const loyaltyPoints = useMemo(() => {
    if (!order) return 0;
    if (typeof order.loyaltyPoints === "number") return order.loyaltyPoints;
    if (total >= LOYALTY_THRESHOLD) {
      return Math.floor((total * NORMAL_RATE) / CREDIT_PER_POINT);
    }
    return 0;
  }, [order, total]);

  const handlePayNow = useCallback(async () => {
    if (!order) return;
    try {
      setRedirecting(true);
      const API_URL = process.env.REACT_APP_API_URL || "https://crunchpay.seed-apps.com";
      const response = await fetch(`${API_URL}/api/payment/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          currency: "XOF",
          order_id: order.id,
          customer_email: order.contact?.email || "client@example.com",
          description: `Commande : ${order.label || order.items?.map(i => i.dishName).join(", ") || order.id}`,
          success_url: `${window.location.origin}/payment/success`,
          failure_url: `${window.location.origin}/payment/failure`,
        }),
      });
      if (!response.ok) throw new Error("Échec de l'initialisation du paiement");
      const data = await response.json();
      if (!data.success || !data.paymentUrl) throw new Error(data.message || "Paiement indisponible");
      window.location.href = data.paymentUrl;
    } catch (e) {
      setError(e.message || "Impossible de démarrer le paiement");
      setRedirecting(false);
    }
  }, [order, total]);

  // --- UI ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-500 animate-pulse">Chargement…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-5 max-w-sm text-center">
          <p className="text-red-600 font-medium mb-2">{error}</p>
          <p className="text-gray-500 text-sm">Réessayez plus tard.</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 flex items-center px-4 py-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1 mr-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={22} />
        </button>
        <h2 className="flex-1 text-center font-bold text-lg text-gray-900">Paiement de la commande</h2>
      </header>

      {/* Content */}
      <main className="p-4 max-w-xl mx-auto space-y-4">
        {/* Infos client */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 text-sm">Détails de livraison</h3>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                order?.isPaid
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-orange-100 text-orange-800 border border-orange-200"
              }`}
              title={order?.isPaid ? "Paiement confirmé" : "Paiement non confirmé"}
            >
              {order?.isPaid ? "Paiement reçu" : "paiement en attente"}
            </span>
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            {phoneNumber && <p><span className="font-medium">Téléphone :</span> {phoneNumber}</p>}
            {(deliveryArea || deliveryAddress) && (
              <p>
                <span className="font-medium">Adresse :</span>{" "}
                {deliveryAddress ? `${deliveryAddress} — ` : ""}{deliveryArea}
              </p>
            )}
            {/* Points affichés dans une carte dédiée ci-dessous */}
          </div>
        </div>

        {/* Loyalty Points (same design as panier.jsx) */}

        {/* Résumé commande */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Résumé de commande</h3>
          <ul className="divide-y divide-gray-100">
            {order.items?.map((it, idx) => {
              const itemData = itemsMap[it.dishId] || {};
              const isSizeBased = itemData?.priceType === "sizes" && it.size;
              const base =
                it.price !== undefined && !isNaN(convertPrice(it.price))
                  ? convertPrice(it.price)
                  : it.dishPrice !== undefined && !isNaN(convertPrice(it.dishPrice))
                  ? convertPrice(it.dishPrice)
                  : isSizeBased
                  ? convertPrice(itemData.sizes?.[it.size] || 0)
                  : convertPrice(itemData.price || 0);
              const extras = it.selectedExtras
                ? Object.entries(it.selectedExtras).reduce((acc, [listId, idxs]) => {
                    const list = extraListsMap[listId]?.extraListElements || [];
                    return acc + idxs.reduce((s, i) => s + convertPrice(list[i]?.price || 0), 0);
                  }, 0)
                : 0;

              return (
                <li key={idx} className="py-3 flex items-start justify-between">
                  <div className="pr-2">
                    <p className="text-sm font-medium text-gray-900">
                      {it.dishName || itemData.name || "Article"}
                      {isSizeBased ? ` (${it.size})` : ""} × {it.quantity}
                    </p>
                    {it.selectedExtras && (
                      <p className="text-xs text-gray-500 mt-1">
                        Extras: {Object.entries(it.selectedExtras)
                          .map(([listId, idxs]) =>
                            idxs.map((i) => extraListsMap[listId]?.extraListElements?.[i]?.name || "").join(", ")
                          )
                          .filter(Boolean)
                          .join("; ")}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatPrice((base + extras) * Number(it.quantity || 1))} FCFA
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Totaux */}
          <div className="pt-3 mt-3 border-t text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Frais de livraison</span>
              <span className="font-medium text-gray-900">{formatPrice(deliveryFee)} FCFA</span>
            </div>
            {order.pointsReduction > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Réduction points</span>
                <span className="font-medium text-red-600">-{formatPrice(convertPrice(order.pointsReduction))} FCFA</span>
              </div>
            )}
            <div className="flex justify-between pt-2 text-base">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-green-600">{formatPrice(total)} FCFA</span>
            </div>
          </div>
          
        </div>

        {/* Suivi de votre commande */}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Suivi de votre commande</h3>
          <div className="relative pl-6">
            {getSteps(order).map((step, index) => {
              const isLast = index === getSteps(order).length - 1;
              const isCompleted = step.stepStatus === "completed";
              return (
                <div key={step.id} className={`relative pb-6 ${isLast ? "pb-0" : ""}`}>
                  {isCompleted ? (
                    <i className="fas fa-check-circle absolute -left-6 top-0 text-lg text-green-500"></i>
                  ) : (
                    <div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-gray-200 border-2 border-gray-300"></div>
                  )}
                  <div className={`pl-4 ${!isLast ? "border-l-2 border-gray-200" : ""}`}>
                    <h4 className={`font-semibold text-sm mb-1 ${isCompleted ? "text-green-700" : "text-gray-500"}`}>{step.title}</h4>
                    <p className={`text-xs mb-2 ${isCompleted ? "text-green-600" : "text-gray-500"}`}>{step.description}</p>
                    {step.timestamp && (
                      <p className="text-xs text-gray-400">
                        {new Date(step.timestamp).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {step.status === ORDER_STATUS.DELIVERING && (
                      <button
                        disabled={order.status !== ORDER_STATUS.DELIVERING}
                        onClick={order.status === ORDER_STATUS.DELIVERING ? confirmDelivery : undefined}
                        className={`w-full mt-4 py-2 rounded-lg font-medium text-sm transition ${
                          order.status === ORDER_STATUS.DELIVERING
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        ✅ Confirmer la livraison
                       
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feedback / Notation */}
        {order.status === ORDER_STATUS.DELIVERED && (
          <div className="bg-white rounded-xl shadow p-4">
            <ThankYouPage order={order} />
          </div>
        )}
        {loyaltyPoints > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-0 mb-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start">
                <Star className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">
                    Points fidélité gagnés : {formatPrice(loyaltyPoints)}
                  </p>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    Vous pouvez utiliser vos points en commandant sur
                    {' '}
                    <a href="https://mangedabord.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-800">
                      mangedabord.com
                    </a>
                  </p>
                </div>
              </div>
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="self-end sm:self-auto ml-auto text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full"
              >
                +{formatPrice(loyaltyPoints)} pts
              </motion.span>
            </div>
          </motion.div>
        )}
        {/* Moyens de paiement */}

      </main>

      {/* CTA Payer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
        <button
          onClick={handlePayNow}
          disabled={redirecting}
          className={`w-full py-3 rounded-lg font-semibold text-white transition flex items-center justify-center gap-2 ${
            redirecting ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {/* Logos dans le bouton, purement informatifs */}
      
          <span>{redirecting ? "Redirection en cours…" : "Payer par OM ou MOMO"}</span>
        </button>
      </div>
    </div>
  );
};

export default CompleteOrderPage;
