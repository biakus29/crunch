import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/cartcontext";
import { auth, db, waitForPersistence } from "../firebase";
import {
  addDoc,
  collection,
  getDocs,
  getDoc,
  Timestamp,
  doc,
  query,
  where,
  updateDoc,
  setDoc,
} from "firebase/firestore";

// Constants
const DEFAULT_DELIVERY_FEE = 1000;
const LOYALTY_THRESHOLD = 5000;
const FIRST_RATE = 0.10;
const NORMAL_RATE = 0.05;
const CREDIT_PER_POINT = 100;

// Component to display and handle order summary
const OrderSummary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const [extraLists, setExtraLists] = useState([]);
  const [quartiersList, setQuartiersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [missingData, setMissingData] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const {
    selectedAddress = {},
    selectedPayment = {},
    contact = {},
    orderData = {},
    isGuest = false,
    deliveryFee: passedDeliveryFee = 0,
  } = location.state || {};

  // Validate location.state
  useEffect(() => {
    if (!location.state) {
      setError("Données de commande manquantes. Redirection vers le panier...");
      const timer = setTimeout(() => navigate("/cart"), 2000);
      return () => clearTimeout(timer);
    }
  }, [location.state, navigate]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch quartiers and extraLists
  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        await waitForPersistence();
        const [quartiersSnap, extraSnap] = await Promise.all([
          getDocs(collection(db, "quartiers")),
          getDocs(collection(db, "extraLists")),
        ]);
        setQuartiersList(quartiersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setExtraLists(extraSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(
          err.code === "unavailable"
            ? "Vous êtes hors ligne. Les données se chargeront lors de la reconnexion."
            : "Échec du chargement des données nécessaires."
        );
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, []);

  // Load user points and eligible orders for authenticated users
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUserPoints(0);
        setEligibleCount(0);
        // setError("Vous devez être connecté pour utiliser les points de fidélité.");
        setDataLoading(false);
        return;
      }

      const uid = currentUser.uid;
      try {
        await waitForPersistence();
        const [userDoc, ordersSnap] = await Promise.all([
          getDoc(doc(db, "usersrestau", uid)),
          getDocs(
            query(
              collection(db, "orders"),
              where("userId", "==", uid),
              where("total", ">=", LOYALTY_THRESHOLD),
              where("loyaltyEligible", "==", true)
            )
          ),
        ]);

        let points = 0;
        if (userDoc.exists()) {
          const userData = userDoc.data();
          points = typeof userData.points === "number" && userData.points >= 0 ? userData.points : 0;
        } else {
          await setDoc(doc(db, "usersrestau", uid), {
            points: 0,
            createdAt: Timestamp.now(),
            email: currentUser.email || "",
            phone: currentUser.phoneNumber || "",
          });
        }
        setUserPoints(points);
        setEligibleCount(ordersSnap.size);
      } catch (err) {
        console.error("Error loading user data:", err);
        setError(
          err.code === "unavailable"
            ? "Vous êtes hors ligne. Les points se chargeront lors de la reconnexion."
            : err.code === "failed-precondition" && err.message.includes("index")
            ? "Configuration de la base de données requise. Veuillez contacter le support."
            : "Erreur lors du chargement des points."
        );
        setUserPoints(0);
        setEligibleCount(0);
      } finally {
        setDataLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Normalize address and payment
  const normalizedAddress = useMemo(
    () => (isGuest && orderData?.address ? orderData.address : selectedAddress),
    [isGuest, orderData, selectedAddress]
  );
  const normalizedPayment = useMemo(
    () => (isGuest && orderData?.paymentMethod ? orderData.paymentMethod : selectedPayment),
    [isGuest, orderData, selectedPayment]
  );

  // Redirect if cart is empty
  useEffect(() => {
    if (!cartItems || cartItems.length === 0) {
      setError("Votre panier est vide. Redirection vers l'accueil...");
      const timer = setTimeout(() => navigate("/"), 2000);
      return () => clearTimeout(timer);
    }
  }, [cartItems, navigate]);

  // Redirect if address or payment is missing
  useEffect(() => {
    if (!normalizedAddress?.area || !normalizedPayment?.name) {
      setMissingData(true);
      setError("Informations d'adresse ou de paiement manquantes. Redirection vers le panier...");
      const timer = setTimeout(() => navigate("/cart"), 2000);
      return () => clearTimeout(timer);
    }
  }, [normalizedAddress, normalizedPayment, navigate]);

  // Convert price to number
  const convertPrice = (price) => {
    if (typeof price === "string") {
      const cleaned = price.replace(/[^0-9.]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return isNaN(Number(price)) ? 0 : Number(price);
  };

  // Calculate items total
  const total = useMemo(() => {
    if (!cartItems || !extraLists.length) return 0;
    return cartItems.reduce((acc, item) => {
      if (!item.price || !item.quantity) return acc;
      let itemTotal = convertPrice(item.price) * item.quantity;
      if (item.selectedExtras) {
        Object.entries(item.selectedExtras).forEach(([extraListId, indexes]) => {
          const extraList = extraLists.find((el) => el.id === extraListId);
          if (extraList?.extraListElements) {
            indexes.forEach((index) => {
              const element = extraList.extraListElements[index];
              if (element?.price) {
                itemTotal += convertPrice(element.price) * item.quantity;
              }
            });
          }
        });
      }
      return acc + itemTotal;
    }, 0);
  }, [cartItems, extraLists]);

  // Get extra names for display
  const getExtraName = (extraListId, index) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    if (!extraList || !extraList.extraListElements || !extraList.extraListElements[index]) {
      return "Extra inconnu";
    }
    const element = extraList.extraListElements[index];
    return `${element.name}${element.price ? ` (+${formatPrice(convertPrice(element.price))} Fcfa)` : ""}`;
  };

  // Calculate delivery fee
  const getDeliveryFee = useMemo(() => {
    return (area) => {
      if (passedDeliveryFee) return Number(passedDeliveryFee);
      if (!area || !quartiersList.length) return DEFAULT_DELIVERY_FEE;
      const quartier = quartiersList.find((q) => q.name.toLowerCase() === area.toLowerCase());
      return quartier ? Number(quartier.fee) : DEFAULT_DELIVERY_FEE;
    };
  }, [passedDeliveryFee, quartiersList]);

  const deliveryFee = getDeliveryFee(normalizedAddress?.area);

  // Calculate loyalty points earned
  const loyaltyPoints = useMemo(() => {
    if (isNaN(total) || total < LOYALTY_THRESHOLD) return 0;
    const rate = eligibleCount === 0 ? FIRST_RATE : NORMAL_RATE;
    const credit = total * rate;
    return Math.floor(credit / CREDIT_PER_POINT);
  }, [total, eligibleCount]);

  // Calculate points-based reduction
  const pointsToUse = useMemo(() => {
    if (!usePoints || userPoints <= 0) return 0;
    return Math.min(userPoints, Math.ceil((total + deliveryFee) / CREDIT_PER_POINT));
  }, [usePoints, userPoints, total, deliveryFee]);

  const pointsReduction = useMemo(() => pointsToUse * CREDIT_PER_POINT, [pointsToUse]);

  // Calculate final total
  const finalTotal = useMemo(() => Math.max(0, total + deliveryFee - pointsReduction), [
    total,
    deliveryFee,
    pointsReduction,
  ]);

  // Format price for display
  const formatPrice = (number) =>
    Number(number).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  // Validate order data
  const isValidOrder = useCallback(() => {
    return (
      cartItems?.every(
        (item) => item.id && item.name && !isNaN(convertPrice(item.price)) && item.quantity > 0
      ) &&
      normalizedAddress?.area &&
      normalizedAddress?.completeAddress &&
      normalizedPayment?.name &&
      (!isGuest || (contact?.name && contact?.phone))
    );
  }, [cartItems, normalizedAddress, normalizedPayment, isGuest, contact]);

  // Handle order confirmation
  const handleConfirmOrder = useCallback(async () => {
    if (!isValidOrder()) {
      setError("Données de commande invalides.");
      return;
    }
    if (!isOnline && normalizedPayment?.id === "payment_mobile" && finalTotal > 0) {
      setError("Vous êtes hors ligne. Les paiements mobiles nécessitent une connexion Internet.");
      return;
    }
    setLoading(true);
    setError("");
    const uid = auth.currentUser?.uid || localStorage.getItem("guestUid") || `guest_${Date.now()}`;

    try {
      await waitForPersistence();
      const orderLabel = cartItems.map((i) => i.name).join(", ");

      let paymentData = null;
      if (normalizedPayment?.id === "payment_mobile" && finalTotal > 0) {
        if (!isOnline) {
          throw new Error("Connexion Internet requise pour le paiement mobile.");
        }

        const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
        const response = await fetch(`${API_URL}/api/payment/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: finalTotal,
            currency: "XOF",
            order_id: `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            customer_email: auth.currentUser?.email || contact?.email || "client@example.com",
            customer_phone: normalizedAddress?.phone || contact?.phone || "",
            description: `Commande : ${orderLabel}`,
            success_url: `${window.location.origin}/payment/success`,
            failure_url: `${window.location.origin}/payment/failure`,
          }),
        });

        if (!response.ok) {
          throw new Error("Échec de l'initialisation du paiement.");
        }

        const paymentResponse = await response.json();

        if (!paymentResponse.success || !paymentResponse.paymentUrl) {
          throw new Error(paymentResponse.message || "Erreur lors de l'initialisation du paiement.");
        }

        const tempOrderData = {
          userId: uid,
          items: cartItems.map((i) => ({
            dishId: i.id,
            quantity: i.quantity,
            price: convertPrice(i.price),
            selectedExtras: i.selectedExtras || null,
          })),
          address: normalizedAddress,
          paymentMethod: normalizedPayment,
          total: finalTotal,
          deliveryFee,
          pointsUsed: pointsToUse,
          pointsReduction,
          loyaltyPoints,
          loyaltyEligible: total >= LOYALTY_THRESHOLD,
          status: normalizedPayment?.id === "payment_mobile" && paymentData?.transactionId ? "pending" : "en_attente",
          isPaid: normalizedPayment?.id === "cash_delivery" ? false : !paymentData?.transactionId,
          timestamp: Timestamp.now(),
          isGuest: !!isGuest,
          label: orderLabel,
          paymentRef: paymentData?.transactionId || null,
        };
        localStorage.setItem("tempOrderData", JSON.stringify(tempOrderData));

        window.location.href = paymentResponse.paymentUrl;
        return;
      }

      const orderRef = await addDoc(collection(db, "orders"), {
        userId: uid,
        items: cartItems.map((i) => ({
          dishId: i.id,
          quantity: i.quantity,
          price: convertPrice(i.price),
          selectedExtras: i.selectedExtras || null,
        })),
        address: normalizedAddress,
        paymentMethod: normalizedPayment,
        total: finalTotal,
        deliveryFee,
        pointsUsed: pointsToUse,
        pointsReduction,
        loyaltyPoints,
        loyaltyEligible: total >= LOYALTY_THRESHOLD,
        status: normalizedPayment?.id === "payment_mobile" && paymentData?.transactionId ? "pending" : "en_attente",
        isPaid: normalizedPayment?.id === "cash_delivery" ? false : !paymentData?.transactionId,
        timestamp: Timestamp.now(),
        isGuest: !!isGuest,
        label: orderLabel,
        paymentRef: paymentData?.transactionId || null,
      });

      if (auth.currentUser && pointsToUse > 0) {
        await updateDoc(doc(db, "usersrestau", uid), {
          points: userPoints - pointsToUse,
        });
      }

      if (auth.currentUser && loyaltyPoints > 0) {
        await addDoc(collection(db, "pointsTransactions"), {
          userId: uid,
          orderId: orderRef.id,
          pointsAmount: loyaltyPoints,
          status: "pending",
          timestamp: Timestamp.now(),
          message: `Points gagnés pour la commande #${orderRef.id.slice(0, 6)}`,
          type: "points_grant",
        });
      }

      clearCart();
      navigate("/complete_order", {
        state: { orderId: orderRef.id, isGuest, paymentStatus: "pending" },
      });
    } catch (err) {
      console.error("Error submitting order:", err);
      setError(err.message || "Erreur lors de la soumission de la commande. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [
    isValidOrder,
    isOnline,
    normalizedPayment,
    finalTotal,
    cartItems,
    normalizedAddress,
    deliveryFee,
    pointsToUse,
    pointsReduction,
    loyaltyPoints,
    isGuest,
    contact,
    userPoints,
    clearCart,
    navigate,
  ]);

  // Check payment return on mount
  useEffect(() => {
    const checkPaymentReturn = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get("payment_status");
      const transactionId = urlParams.get("transaction_id");
      const orderId = urlParams.get("order_id");

      if (!paymentStatus || !transactionId || !orderId) return;

      try {
        setLoading(true);
        const tempOrderData = JSON.parse(localStorage.getItem("tempOrderData"));

        if (!tempOrderData) {
          throw new Error("Données de la commande non trouvées. Veuillez réessayer.");
        }

        const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
        const response = await fetch(`${API_URL}/api/payment/status?transaction_id=${transactionId}`);
        if (!response.ok) {
          throw new Error("Échec de la vérification du statut du paiement. Veuillez réessayer.");
        }

        const statusData = await response.json();
        if (!statusData.success) {
          throw new Error(statusData.message || "Échec de la vérification du paiement.");
        }

        const isPaymentSuccess = statusData.status === "success";
        const finalStatus = isPaymentSuccess ? "confirmed" : "failed";

        const orderRef = await addDoc(collection(db, "orders"), {
          ...tempOrderData,
          status: finalStatus,
          isPaid: isPaymentSuccess,
          paymentRef: transactionId,
          timestamp: Timestamp.now(),
        });

        if (auth.currentUser && tempOrderData.pointsUsed > 0) {
          await updateDoc(doc(db, "usersrestau", tempOrderData.userId), {
            points: userPoints - tempOrderData.pointsUsed,
          });
        }

        if (auth.currentUser && isPaymentSuccess && tempOrderData.loyaltyPoints > 0) {
          await addDoc(collection(db, "pointsTransactions"), {
            userId: tempOrderData.userId,
            orderId: orderRef.id,
            pointsAmount: tempOrderData.loyaltyPoints,
            status: "pending",
            timestamp: Timestamp.now(),
            message: `Points gagnés pour la commande #${orderRef.id.slice(0, 6)}`,
            type: "points_grant",
          });
        }

        localStorage.removeItem("tempOrderData");
        clearCart();
        navigate("/complete_order", {
          state: {
            orderId: orderRef.id,
            isGuest: tempOrderData.isGuest,
            paymentStatus: finalStatus,
            transactionId,
          },
        });
      } catch (err) {
        console.error("Erreur après retour de paiement :", err);
        setError(`Erreur de traitement du paiement : ${err.message}. Veuillez contacter le support.`);
        navigate("/payment/failure", { state: { error: err.message } });
      } finally {
        setLoading(false);
      }
    };

    checkPaymentReturn();
  }, [navigate, clearCart, userPoints, setLoading]);

  // Render loading or error states
  if (dataLoading || !cartItems || cartItems.length === 0 || missingData || !isValidOrder()) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          {dataLoading && <p>Chargement des données...</p>}
          {!cartItems?.length && <p className="text-red-600 mb-4">Votre panier est vide.</p>}
          {missingData && (
            <p className="text-red-600 mb-4">Informations de commande manquantes.</p>
          )}
          {!isValidOrder() && <p className="text-red-600 mb-4">Données de commande invalides.</p>}
          <p>Redirection...</p>
        </div>
      </div>
    );
  }

  const maxPointsUsable = Math.min(userPoints, Math.ceil((total + deliveryFee) / CREDIT_PER_POINT));

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white border-b p-3 sticky top-0 z-10">
        <h2 className="text-center font-bold text-xl">Récapitulatif de la commande</h2>
      </header>
      <div className="p-3">
        {!isOnline && (
          <div
            className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4"
            role="alert"
          >
            <span className="block sm:inline">
              Vous êtes hors ligne. Certaines actions seront synchronisées lors de la reconnexion.
            </span>
          </div>
        )}
        {error && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
            role="alert"
          >
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <div className="bg-white p-3 rounded shadow-sm mb-3">
          <h4 className="font-bold mb-2">Détails de la commande</h4>
          <div className="mb-4 bg-gray-50 p-3 rounded-lg">
            <h6 className="font-bold text-gray-800 mb-2">Adresse de livraison :</h6>
            <div className="text-sm text-gray-700">
              <p>
                <span className="font-medium">Type :</span> {normalizedAddress?.nickname}
              </p>
              <p>
                <span className="font-medium">Ville :</span> YAOUNDE
              </p>
              <p>
                <span className="font-medium">Quartier :</span> {normalizedAddress?.area}
              </p>
              <p>
                <span className="font-medium">Description :</span>{" "}
                {normalizedAddress?.completeAddress}
              </p>
              {normalizedAddress?.instructions && (
                <p>
                  <span className="font-medium">Instructions :</span>{" "}
                  {normalizedAddress.instructions}
                </p>
              )}
              <p>
                <span className="font-medium">Téléphone :</span>{" "}
                {normalizedAddress?.phone || contact?.phone}
              </p>
              {isGuest && contact?.name && (
                <p>
                  <span className="font-medium">Nom :</span> {contact.name}
                </p>
              )}
            </div>
          </div>
          <div className="mb-4 bg-gray-50 p-3 rounded-lg">
            <h6 className="font-bold text-gray-800 mb-2">Méthode de paiement :</h6>
            <div className="flex items-center">
              <i className={`${normalizedPayment?.icon || "fa fa-question"} text-green-600 text-xl mr-3`}></i>
              <div>
                <p className="font-semibold">{normalizedPayment?.name}</p>
                <p className="text-sm text-gray-500">{normalizedPayment?.description}</p>
                {normalizedPayment?.phone && (
                  <p className="text-sm text-gray-500">
                    Téléphone : {normalizedPayment.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
          {auth.currentUser && userPoints > 0 && (
            <div className="mb-4 bg-gray-50 p-3 rounded-lg">
              <h6 className="font-bold text-gray-800 mb-2">Points de fidélité</h6>
              <div className="flex flex-col space-y-2">
                <div>
                  <p className="font-semibold">Vos points : {formatPrice(userPoints)}</p>
                  <p className="text-sm text-gray-500">
                    Utilisez les points pour réduire le total (1 point = 100 Fcfa). Max utilisable :{" "}
                    {formatPrice(maxPointsUsable)} points.
                  </p>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePoints}
                    onChange={(e) => setUsePoints(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  <span className="ms-3 text-sm font-medium text-gray-900">
                    {usePoints
                      ? `Utiliser ${formatPrice(pointsToUse)} points pour ${formatPrice(
                          pointsReduction
                        )} Fcfa de réduction`
                      : "Payer sans points"}
                  </span>
                </label>
                {usePoints && pointsToUse > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    Réduction automatique : {formatPrice(pointsReduction)} Fcfa (
                    {formatPrice(pointsToUse)} points)
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="mb-4 bg-gray-50 p-3 rounded-lg">
            <h6 className="font-bold text-gray-800 mb-2">Points gagnés</h6>
            <p className="text-sm">
              {loyaltyPoints > 0
                ? `Vous gagnerez ${formatPrice(
                    loyaltyPoints
                  )} point(s) pour cette commande après confirmation du paiement.`
                : "Commande non éligible aux points (montant minimum : 5000 Fcfa)."}
            </p>
            {loyaltyPoints > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                Les points seront crédités sur votre compte après validation du paiement.
              </p>
            )}
          </div>
          <h6 className="font-bold text-gray-800 mb-2">Articles commandés :</h6>
          {cartItems.map((item) => (
            <div
              key={`${item.id}-${Object.entries(item.selectedExtras || {})
                .map(([listId, indexes]) => `${listId}:${indexes.join(",")}`)
                .join("|")}`}
              className="border-b py-3 last:border-b-0"
            >
              <div className="flex items-start">
                <img
                  src={item.covers?.[0] || "/img/default.png"}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded mr-3"
                />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h5 className="font-semibold">{item.name}</h5>
                    <p className="text-green-600">
                      {formatPrice(convertPrice(item.price))} Fcfa × {item.quantity}
                    </p>
                  </div>
                  {item.selectedExtras && (
                    <div className="mt-1 text-sm text-gray-600">
                      {Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
                        <div key={extraListId} className="mb-1">
                          <span className="font-medium">
                            {extraLists.find((el) => el.id === extraListId)?.name || "Extras"} :
                          </span>
                          {indexes.map((index) => (
                            <div key={index} className="ml-2">
                              {getExtraName(extraListId, index)}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {pointsReduction < total + deliveryFee && (
          <div className="bg-gray-50 p-3 rounded-lg mb-4">
            <h6 className="font-bold text-gray-800 mb-2">Frais de livraison</h6>
            <p className="text-sm">
              {normalizedAddress?.area
                ? `${normalizedAddress.area} : ${formatPrice(deliveryFee)} Fcfa`
                : `Inconnu : ${formatPrice(DEFAULT_DELIVERY_FEE)} Fcfa`}
            </p>
            <p className="text-xs text-gray-600">
              Note : Ce prix est basé sur le quartier et peut être ajusté si l'accès est difficile.
            </p>
          </div>
        )}
        <div className="bg-white p-3 rounded shadow-sm">
          <div className="flex justify-between font-bold text-lg">
            <span>Total :</span>
            <span className="text-green-600">
              {isNaN(finalTotal) || !extraLists.length
                ? "Calcul en cours..."
                : `${formatPrice(finalTotal)} Fcfa`}
            </span>
          </div>
          {pointsReduction > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              <p>
                <span className="font-semibold">Réduction points :</span>{" "}
                {formatPrice(pointsReduction)} Fcfa ({formatPrice(pointsToUse)} points)
              </p>
              <p className="text-xs">
                La réduction sera appliquée après validation par l'administrateur.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 shadow-lg">
        <button
          onClick={handleConfirmOrder}
          disabled={
            loading || (!isOnline && normalizedPayment?.id === "payment_mobile" && finalTotal > 0)
          }
          aria-label={
            loading
              ? "Traitement de la commande"
              : pointsReduction >= total + deliveryFee
              ? "Confirmer avec points"
              : "Confirmer la commande"
          }
          className={`w-full py-3 text-white rounded-lg transition-colors ${
            loading || (!isOnline && normalizedPayment?.id === "payment_mobile" && finalTotal > 0)
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-label="Chargement"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Traitement...
            </span>
          ) : pointsReduction >= total + deliveryFee ? (
            "Confirmer avec points"
          ) : (
            "Confirmer la commande"
          )}
        </button>
      </div>
    </div>
  );
};

export default OrderSummary;