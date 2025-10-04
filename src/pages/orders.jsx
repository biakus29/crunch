
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  runTransaction,
} from "firebase/firestore";

// Constants
export const DEFAULT_DELIVERY_FEE = 1000;
const LOYALTY_THRESHOLD = 5000;
const FIRST_RATE = 0.10;
const NORMAL_RATE = 0.05;
const CREDIT_PER_POINT = 100;
const TEMP_ORDER_TIMEOUT = 2 * 60 * 60 * 1000; // 2 heures

const OrderSummary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const [extraLists, setExtraLists] = useState([]);
  const [quartiersList, setQuartiersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState({
    cart: "",
    address: "",
    payment: "",
    contact: "",
    general: "",
  });
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

  // Normalize address and payment
  const normalizedAddress = useMemo(
    () =>
      isGuest && orderData?.address && orderData.address.area
        ? orderData.address
        : selectedAddress && selectedAddress.area
        ? selectedAddress
        : { area: "", completeAddress: "" },
    [isGuest, orderData, selectedAddress]
  );
  const normalizedPayment = useMemo(
    () => (isGuest && orderData?.paymentMethod ? orderData.paymentMethod : selectedPayment),
    [isGuest, orderData, selectedPayment]
  );

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const fetchData = async () => {
        try {
          await waitForPersistence();
          const extraSnap = await getDocs(collection(db, "extraLists"));
          const extras = extraSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setExtraLists(extras);
        } catch (err) {
          console.error("Erreur lors du rechargement des extras:", err);
        }
      };
      fetchData();
    };
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
        const quartiers = quartiersSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((q) => q.name && typeof q.name === "string");
        const extras = extraSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setQuartiersList(quartiers);
        setExtraLists(extras);
        if (quartiers.length === 0) {
          console.warn("Aucun quartier trouvé dans Firestore.");
          setErrors((prev) => ({
            ...prev,
            general: "Aucun quartier disponible. Contactez le support.",
          }));
        }
        if (extras.length === 0) {
          console.warn("Aucun extraList trouvé dans Firestore.");
          setErrors((prev) => ({
            ...prev,
            general: "Aucun extra disponible. Contactez le support si cela persiste.",
          }));
        }
      } catch (err) {
        console.error("Erreur lors du chargement des données:", err);
        setErrors((prev) => ({
          ...prev,
          general: err.code === "unavailable"
            ? "Vous êtes hors ligne. Les données se chargeront lors de la reconnexion."
            : "Échec du chargement des données nécessaires. Veuillez réessayer.",
        }));
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, []);

  // Load user points and eligible orders
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUserPoints(0);
        setEligibleCount(0);
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
        console.error("Erreur lors du chargement des données utilisateur:", err);
        setErrors((prev) => ({
          ...prev,
          general: err.code === "unavailable"
            ? "Vous êtes hors ligne. Les points se chargeront lors de la reconnexion."
            : "Erreur lors du chargement des points.",
        }));
        setUserPoints(0);
        setEligibleCount(0);
      } finally {
        setDataLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Calculate delivery fee
  const getDeliveryFee = useMemo(() => {
    return (area) => {
      if (passedDeliveryFee) return Number(passedDeliveryFee);
      if (!area || typeof area !== "string" || !quartiersList.length) {
        console.warn("area invalide ou quartiersList vide:", { area, quartiersList });
        return DEFAULT_DELIVERY_FEE;
      }
      const quartier = quartiersList.find(
        (q) => q.name && typeof q.name === "string" && q.name.toLowerCase() === area.toLowerCase()
      );
      if (!quartier) {
        console.warn(`Aucun quartier trouvé pour area: ${area}`);
      }
      return quartier ? Number(quartier.fee) : DEFAULT_DELIVERY_FEE;
    };
  }, [passedDeliveryFee, quartiersList]);

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
    if (!cartItems || !extraLists.length) {
      return 0;
    }
    return cartItems.reduce((acc, item) => {
      if (!item.price || !item.quantity) {
        console.warn("Article invalide:", item);
        return acc;
      }
      let itemTotal = convertPrice(item.price) * item.quantity;
      if (item.selectedExtras) {
        Object.entries(item.selectedExtras).forEach(([extraListId, indexes]) => {
          const extraList = extraLists.find((el) => el.id === extraListId);
          if (!extraList || !extraList.extraListElements) {
            console.warn(`ExtraList ${extraListId} non trouvé pour l'article ${item.id}`);
            return;
          }
          indexes.forEach((index) => {
            if (index >= 0 && index < extraList.extraListElements.length) {
              const element = extraList.extraListElements[index];
              const extraPrice = convertPrice(element?.price);
              if (element && !isNaN(extraPrice)) {
                itemTotal += extraPrice * item.quantity;
              } else {
                console.warn(
                  `Extra invalide à l'index ${index} pour l'extraList ${extraListId}: élément manquant ou mal formé`
                );
              }
            } else {
              console.warn(
                `Index ${index} hors limites pour l'extraList ${extraListId}`
              );
            }
          });
        });
      }
      return acc + itemTotal;
    }, 0);
  }, [cartItems, extraLists]);

  // Get extra names for display
  const getExtraName = (extraListId, index) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    if (!extraList || !extraList.extraListElements || !extraList.extraListElements[index]) {
      console.warn(`Extra non trouvé: extraListId=${extraListId}, index=${index}`);
      return "Extra inconnu";
    }
    const element = extraList.extraListElements[index];
    const extraPrice = convertPrice(element.price);
    return `${element.name}${extraPrice > 0 ? ` (+${formatPrice(extraPrice)} Fcfa)` : ""}`;
  };

  console.warn("Avant getDeliveryFee:", {
    normalizedAddress,
    area: normalizedAddress?.area,
    quartiersList,
  });
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
    const maxPoints = Math.floor((total + deliveryFee) / CREDIT_PER_POINT);
    const points = Math.min(userPoints, maxPoints);
    if (points * CREDIT_PER_POINT > total + deliveryFee) {
      setErrors((prev) => ({
        ...prev,
        general: "Erreur dans le calcul des points. La réduction dépasse le total de la commande.",
      }));
      return 0;
    }
    return points;
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
    let isValid = true;
    const errors = {
      cart: "",
      address: "",
      payment: "",
      contact: "",
      general: "",
    };

    // Validate cart
    if (!cartItems || cartItems.length === 0) {
      errors.cart = "Votre panier est vide.";
      isValid = false;
    } else if (
      !cartItems.every(
        (item) =>
          item.id &&
          item.name &&
          !isNaN(convertPrice(item.price)) &&
          item.quantity > 0
      )
    ) {
      errors.cart = "Certains articles du panier sont invalides.";
      isValid = false;
    }

    // Validate address
    if (!normalizedAddress) {
      errors.address = "Aucune adresse fournie.";
      isValid = false;
    } else {
      if (!normalizedAddress.area || typeof normalizedAddress.area !== "string") {
        errors.address = "Le quartier est requis et doit être valide.";
        isValid = false;
      }
      if (!normalizedAddress.completeAddress) {
        errors.address = errors.address
          ? `${errors.address} L'adresse complète est requise.`
          : "L'adresse complète est requise.";
        isValid = false;
      }
    }

    // Validate payment
    if (!normalizedPayment?.name) {
      errors.payment = "Veuillez sélectionner une méthode de paiement.";
      isValid = false;
    }

    // Validate contact for guests
    if (isGuest) {
      if (!contact?.name) {
        errors.contact = "Le nom est requis pour les invités.";
        isValid = false;
      }
      if (!contact?.phone) {
        errors.contact = errors.contact
          ? `${errors.contact} Le numéro de téléphone est requis.`
          : "Le numéro de téléphone est requis.";
        isValid = false;
      }
    }

    // Validate delivery fee
    if (isNaN(deliveryFee) || deliveryFee < 0) {
      errors.general = "Frais de livraison invalides.";
      isValid = false;
    }

    // Validate extraLists
    if (!extraLists || extraLists.length === 0) {
      errors.general = errors.general
        ? `${errors.general} Données des extras non disponibles.`
        : "Données des extras non disponibles.";
      isValid = false;
    }

    return { isValid, errors };
  }, [cartItems, normalizedAddress, normalizedPayment, isGuest, contact, extraLists, deliveryFee]);

  // Check validity on mount
  const isValidOrderRef = useRef(isValidOrder);
  useEffect(() => {
    isValidOrderRef.current = isValidOrder;
  }, [isValidOrder]);

  useEffect(() => {
    if (dataLoading) {
      return;
    }
    if (
      !location.state ||
      !normalizedAddress ||
      !normalizedAddress.area ||
      typeof normalizedAddress.area !== "string"
    ) {
      console.warn("Données de commande ou d'adresse invalides:", {
        locationState: location.state,
        normalizedAddress,
      });
      setErrors((prev) => ({
        ...prev,
        general: "Données de commande ou d'adresse manquantes. Veuillez sélectionner une adresse valide.",
      }));
      navigate("/checkout", { replace: true });
      return;
    }
    const { isValid, errors } = isValidOrderRef.current();
    setErrors((prev) => ({ ...prev, ...errors }));
  }, [location.state, normalizedAddress, dataLoading, navigate]);

  // Handle order confirmation
const handleConfirmOrder = useCallback(async () => {
  const { isValid, errors } = isValidOrder();
  if (!isValid) {
    setErrors((prev) => ({
      ...prev,
      ...errors,
      general: "Veuillez corriger les erreurs ci-dessus avant de confirmer.",
    }));
    return;
  }

  if (!isOnline && normalizedPayment?.id === "payment_mobile" && finalTotal > 0) {
    setErrors((prev) => ({
      ...prev,
      general: "Vous êtes hors ligne. Les paiements mobiles nécessitent une connexion Internet.",
    }));
    return;
  }

  setLoading(true);
  setErrors((prev) => ({ ...prev, general: "" }));
  const uid = auth.currentUser?.uid || localStorage.getItem("guestUid") || `guest_${Date.now()}`;
  const orderLabel = cartItems.map((i) => i.name).join(", ");

  try {
    await waitForPersistence();
    // Créer la commande dans Firestore pour les deux méthodes de paiement
    const orderRef = await runTransaction(db, async (transaction) => {
      const orderRef = doc(collection(db, "orders"));
      const userRef = auth.currentUser ? doc(db, "usersrestau", uid) : null;

      // TOUTES LES LECTURES DOIVENT ÊTRE FAITES EN PREMIER
      let userDoc = null;
      if (auth.currentUser && pointsToUse > 0 && userRef) {
        userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("Utilisateur non trouvé.");
        }
      }

      // MAINTENANT TOUTES LES ÉCRITURES
      transaction.set(orderRef, {
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
        status: "en_attente", // Statut initial pour les deux méthodes
        isPaid: false, // Non payé jusqu'à confirmation
        timestamp: Timestamp.now(),
        isGuest: !!isGuest,
        label: orderLabel,
        paymentRef: null, // Sera mis à jour pour paiement mobile
      });

      if (auth.currentUser && pointsToUse > 0 && userDoc) {
        transaction.update(userRef, {
          points: userDoc.data().points - pointsToUse,
        });
      }

      if (auth.currentUser && loyaltyPoints > 0) {
        const pointsTransactionRef = doc(collection(db, "pointsTransactions"));
        transaction.set(pointsTransactionRef, {
          userId: uid,
          orderId: orderRef.id,
          pointsAmount: loyaltyPoints,
          status: "pending",
          timestamp: Timestamp.now(),
          message: `Points gagnés pour la commande #${orderRef.id.slice(0, 6)}`,
          type: "points_grant",
        });
      }

      return orderRef;
    });
    // Si paiement mobile, initier le paiement
    if (normalizedPayment?.id === "payment_mobile" && finalTotal > 0) {
      const API_URL = process.env.REACT_APP_API_URL || "https://crunchpay.seed-apps.com";
      const response = await fetch(`${API_URL}/api/payment/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: finalTotal,
          currency: "XOF",
          order_id: orderRef.id, // Utiliser l'ID de la commande Firestore
          customer_email: auth.currentUser?.email || contact?.email || "client@example.com",
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

      // Enregistrer le paiement en statut 'attente' dans Firestore
      await addDoc(collection(db, "payments"), {
        orderId: orderRef.id,
        transactionId: paymentResponse.transactionId,
        amount: finalTotal,
        currency: "XOF",
        method: "mobile_money",
        status: "pending",
        customerEmail: auth.currentUser?.email || contact?.email || "client@example.com",
        description: `Commande : ${orderLabel}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Stocker l'ID de la commande et l'ID de la transaction pour le retour
      localStorage.setItem("pendingOrder", JSON.stringify({
        orderId: orderRef.id,
        transactionId: paymentResponse.transactionId,
        timestamp: new Date().toISOString(),
      }));

      try {
        window.location.href = paymentResponse.paymentUrl;
      } catch (err) {
        console.error("Erreur lors de la redirection au paiement:", err);
        setErrors((prev) => ({
          ...prev,
          general: "Échec de la redirection au paiement. La commande est enregistrée, vérifiez son statut.",
        }));
        setLoading(false);
        navigate("/complete_order", {
          state: { orderId: orderRef.id, isGuest, paymentStatus: "en_attente" },
          replace: true,
        });
        return;
      }
    } else {
      // Pour paiement en cash, rediriger directement
      setIsSubmitted(true);
      clearCart();
      navigate("/complete_order", {
        state: { orderId: orderRef.id, isGuest, paymentStatus: "en_attente" },
        replace: true,
      });
    }
  } catch (err) {
    console.error("Erreur lors de la soumission de la commande:", err);
    setErrors((prev) => ({
      ...prev,
      general: err.message || "Erreur lors de la soumission de la commande. Veuillez réessayer.",
    }));
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
  clearCart,
  navigate,
]);
  // Check payment return
  useEffect(() => {
    const checkPaymentReturn = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get("payment_status");
      const transactionId = urlParams.get("transaction_id");
      const orderId = urlParams.get("order_id");
      let tempOrderData = JSON.parse(localStorage.getItem("tempOrderData"));

      // Nettoyer les données temporaires obsolètes
      if (tempOrderData && tempOrderData.timestamp) {
        const orderAge = Date.now() - Date.parse(tempOrderData.timestamp);
        if (orderAge > TEMP_ORDER_TIMEOUT) {
          localStorage.removeItem("tempOrderData");
          tempOrderData = null;
        }
      }

      if (!paymentStatus && !transactionId && !orderId && tempOrderData) {
        setErrors((prev) => ({
          ...prev,
          general: "Une commande temporaire est en attente. Veuillez réessayer ou nettoyer les données temporaires.",
        }));
        return;
      }

      if (!paymentStatus || !transactionId || !orderId) return;

      try {
        setLoading(true);
        if (!tempOrderData) {
          throw new Error("Données de la commande non trouvées. Veuillez réessayer.");
        }

        const API_URL = process.env.REACT_APP_API_URL || "https://crunchpay.seed-apps.com";
        const response = await fetch(`${API_URL}/api/payment/status?transaction_id=${transactionId}`);
        if (!response.ok) {
          throw new Error("Échec de la vérification du statut du paiement.");
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
        setIsSubmitted(true);
        clearCart();
        try {
          navigate("/complete_order", {
            state: {
              orderId: orderRef.id,
              isGuest: tempOrderData.isGuest,
              paymentStatus: finalStatus,
              transactionId,
            },
            replace: true,
          });
        } catch (navError) {
          console.error("Erreur de navigation après retour de paiement:", navError);
          setErrors((prev) => ({
            ...prev,
            general: "Commande traitée, mais redirection échouée. Vérifiez l'état de votre commande.",
          }));
          setLoading(false);
        }
      } catch (err) {
        console.error("Erreur après retour de paiement:", err);
        localStorage.removeItem("tempOrderData");
        setErrors((prev) => ({
          ...prev,
          general: `Erreur de traitement du paiement : ${err.message}. Veuillez contacter le support.`,
        }));
        navigate("/payment/failure", {
          state: { error: err.message },
          replace: true,
        });
      } finally {
        setLoading(false);
      }
    };

    checkPaymentReturn();
  }, [auth, userPoints, clearCart, navigate]);

  // Display loader if order is submitted
  if (isSubmitted || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center">
          <svg
            className="animate-spin h-12 w-12 text-green-600"
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
          <span className="mt-2 text-gray-600">
            {dataLoading ? "Chargement des données..." : "Traitement de la commande..."}
          </span>
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
        {errors.general && (
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
            role="alert"
          >
            <span className="block sm:inline">{errors.general}</span>
            {errors.general.includes("commande temporaire") && (
              <button
                onClick={() => {
                  localStorage.removeItem("tempOrderData");
                  navigate("/checkout", { replace: true });
                }}
                className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Nettoyer et réessayer
              </button>
            )}
          </div>
        )}
        <div className={`bg-white p-3 rounded shadow-sm mb-3 ${errors.address || errors.contact ? "border border-red-500" : ""}`}>
          <h4 className="font-bold mb-2">Détails de la commande</h4>
          <div className="mb-4 bg-gray-50 p-3 rounded-lg">
            <h6 className="font-bold text-gray-800 mb-2">Adresse de livraison :</h6>
            {errors.address ? (
              <p className="text-red-600 mb-2">{errors.address}</p>
            ) : (
              <div className="text-sm text-gray-700">
                <p>
                  <span className="font-medium">Type :</span> {normalizedAddress?.nickname || "Non spécifié"}
                </p>
                <p>
                  <span className="font-medium">Ville :</span> YAOUNDE
                </p>
                <p>
                  <span className="font-medium">Quartier :</span> {normalizedAddress?.area || "Non spécifié"}
                </p>
                <p>
                  <span className="font-medium">Description :</span>{" "}
                  {normalizedAddress?.completeAddress || "Non spécifié"}
                </p>
                {normalizedAddress?.instructions && (
                  <p>
                    <span className="font-medium">Instructions :</span>{" "}
                    {normalizedAddress.instructions}
                  </p>
                )}
                <p>
                  <span className="font-medium">Téléphone :</span>{" "}
                  {normalizedAddress?.phone || contact?.phone || "Non spécifié"}
                </p>
              </div>
            )}
            {isGuest && (
              <>
                <h6 className="font-bold text-gray-800 mt-4 mb-2">Contact :</h6>
                {errors.contact ? (
                  <p className="text-red-600 mb-2">{errors.contact}</p>
                ) : (
                  <div className="text-sm text-gray-700">
                    <p>
                      <span className="font-medium">Nom :</span> {contact?.name || "Non spécifié"}
                    </p>
                    <p>
                      <span className="font-medium">Téléphone :</span> {contact?.phone || "Non spécifié"}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <div className={`mb-4 bg-gray-50 p-3 rounded-lg ${errors.payment ? "border border-red-500" : ""}`}>
            <h6 className="font-bold text-gray-800 mb-2">Méthode de paiement :</h6>
            {errors.payment ? (
              <p className="text-red-600 mb-2">{errors.payment}</p>
            ) : (
              <div className="flex items-center">
                <i className={`${normalizedPayment?.icon || "fa fa-question"} text-green-600 text-xl mr-3`}></i>
                <div>
                  <p className="font-semibold">{normalizedPayment?.name || "Non spécifié"}</p>
                  <p className="text-sm text-gray-500">{normalizedPayment?.description || ""}</p>
                </div>
              </div>
            )}
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
                      ? `Utiliser ${formatPrice(pointsToUse)} points pour ${formatPrice(pointsReduction)} Fcfa de réduction`
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
                ? `Vous gagnerez ${formatPrice(loyaltyPoints)} point(s) pour cette commande après confirmation du paiement.`
                : "Commande non éligible aux points (montant minimum : 5000 Fcfa)."}
            </p>
            {loyaltyPoints > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                Les points seront crédités sur votre compte après validation du paiement.
              </p>
            )}
          </div>
          <h6 className={`font-bold text-gray-800 mb-2 ${errors.cart ? "text-red-600" : ""}`}>Articles commandés :</h6>
          {errors.cart ? (
            <p className="text-red-600 mb-2">{errors.cart}</p>
          ) : (
            cartItems.map((item) => (
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
            ))
          )}
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
          disabled={loading || (!isOnline && normalizedPayment?.id === "payment_mobile" && finalTotal > 0)}
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
