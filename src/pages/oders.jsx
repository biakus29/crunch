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
} from "firebase/firestore";
import { appInit, initTrx, getTrxStatus } from "./flashup";

const DEFAULT_DELIVERY_FEE = 1000;
const LOYALTY_THRESHOLD = 5000;
const FIRST_RATE = 0.1;
const NORMAL_RATE = 0.05;
const CREDIT_PER_POINT = 100;

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
        setQuartiersList(
          quartiersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setExtraLists(
          extraSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (err) {
        console.error("Erreur lors du chargement des données:", err);
        if (err.code === "unavailable") {
          setError(
            "Vous êtes hors ligne. Les données seront chargées lorsque vous serez connecté."
          );
        } else {
          setError("Impossible de charger les données nécessaires.");
        }
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch user points and eligible orders
  useEffect(() => {
    if (isGuest || !auth.currentUser?.uid) {
      setUserPoints(0);
      setEligibleCount(0);
      return;
    }
    const uid = auth.currentUser.uid;
    const fetchUserData = async () => {
      try {
        await waitForPersistence();
        const [userDoc, ordersSnap] = await Promise.all([
          getDoc(doc(db, "users", uid)),
          getDocs(
            query(
              collection(db, "orders"),
              where("userId", "==", uid),
              where("total", ">=", LOYALTY_THRESHOLD),
              where("loyaltyEligible", "==", true)
            )
          ),
        ]);
        if (userDoc.exists()) setUserPoints(userDoc.data().points || 0);
        setEligibleCount(ordersSnap.size);
      } catch (err) {
        console.error(
          "Erreur lors du chargement des données utilisateur:",
          err
        );
        if (err.code === "unavailable") {
          setError(
            "Vous êtes hors ligne. Les points seront chargés lorsque vous serez connecté."
          );
        } else if (
          err.code === "failed-precondition" &&
          err.message.includes("index")
        ) {
          setError(
            "Configuration de la base de données requise. Veuillez contacter le support."
          );
        } else {
          setError("Impossible de charger les données utilisateur.");
        }
      }
    };
    fetchUserData();
  }, [isGuest]);

  // Normalize address and payment
  const normalizedAddress = useMemo(
    () => (isGuest && orderData?.address ? orderData.address : selectedAddress),
    [isGuest, orderData, selectedAddress]
  );
  const normalizedPayment = useMemo(
    () =>
      isGuest && orderData?.paymentMethod
        ? orderData.paymentMethod
        : selectedPayment,
    [isGuest, orderData, selectedPayment]
  );

  // Redirect if cart is empty
  useEffect(() => {
    if (!cartItems || cartItems.length === 0) {
      setError("Votre panier est vide. Redirection vers la page d'accueil...");
      const timer = setTimeout(() => navigate("/"), 2000);
      return () => clearTimeout(timer);
    }
  }, [cartItems, navigate]);

  // Redirect if missing address or payment
  useEffect(() => {
    if (!normalizedAddress || !normalizedPayment) {
      setMissingData(true);
      const timer = setTimeout(() => navigate("/cart"), 2000);
      return () => clearTimeout(timer);
    }
  }, [normalizedAddress, normalizedPayment, navigate]);

  // Convert price helper
  const convertPrice = (price) => {
    if (typeof price === "string") {
      const cleaned = price.replace(/[^0-9.]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return isNaN(Number(price)) ? 0 : Number(price);
  };

  // Calculate total
  const total = useMemo(() => {
    if (!cartItems || !extraLists) return 0;
    return cartItems.reduce((acc, item) => {
      if (!item.price || !item.quantity) return acc;
      let itemTotal = convertPrice(item.price) * item.quantity;
      if (item.selectedExtras) {
        Object.entries(item.selectedExtras).forEach(
          ([extraListId, indexes]) => {
            const extraList = extraLists.find((el) => el.id === extraListId);
            if (extraList) {
              indexes.forEach((index) => {
                const element = extraList.extraListElements?.[index];
                if (element?.price) {
                  itemTotal += convertPrice(element.price) * item.quantity;
                }
              });
            }
          }
        );
      }
      return acc + itemTotal;
    }, 0);
  }, [cartItems, extraLists]);

  // Get extra name
  const getExtraName = (extraListId, index) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    const element = extraList?.extraListElements?.[index];
    return element
      ? `${element.name}${
          element.price
            ? ` (+${convertPrice(element.price).toLocaleString()} Fcfa)`
            : ""
        }`
      : "Extra inconnu";
  };

  // Calculate delivery fee
  const getDeliveryFee = useMemo(() => {
    return (area) => {
      if (passedDeliveryFee) return Number(passedDeliveryFee);
      if (!area || quartiersList.length === 0) return DEFAULT_DELIVERY_FEE;
      const quartier = quartiersList.find(
        (q) => q.name.toLowerCase() === area.toLowerCase()
      );
      return quartier ? Number(quartier.fee) : DEFAULT_DELIVERY_FEE;
    };
  }, [passedDeliveryFee, quartiersList]);

  const deliveryFee = usePoints ? 0 : getDeliveryFee(normalizedAddress?.area);

  // Calculate loyalty points
  const loyaltyPoints = useMemo(() => {
    if (isNaN(total) || total < LOYALTY_THRESHOLD) return 0;
    const rate = eligibleCount === 0 ? FIRST_RATE : NORMAL_RATE;
    const credit = total * rate;
    return Math.floor(credit / CREDIT_PER_POINT);
  }, [total, eligibleCount]);

  // Format price
  const formatPrice = (number) =>
    Number(number).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  // Validate order
  const isValidOrder = () => {
    return (
      cartItems?.every(
        (item) =>
          item.id &&
          item.name &&
          !isNaN(convertPrice(item.price)) &&
          item.quantity > 0
      ) &&
      normalizedAddress?.area &&
      normalizedAddress?.completeAddress &&
      normalizedPayment?.name &&
      (!isGuest || (contact?.name && contact?.phone))
    );
  };

  // Handle order confirmation
  const handleConfirmOrder = useCallback(async () => {
    if (!isValidOrder()) {
      setError("Données de commande invalides.");
      return;
    }
    if (!isOnline && normalizedPayment?.id === "payment_mobile") {
      setError(
        "Vous êtes hors ligne. Les paiements mobiles nécessitent une connexion Internet."
      );
      return;
    }
    setLoading(true);
    setError("");
    const uid = auth.currentUser?.uid || localStorage.getItem("guestUid");

    try {
      await waitForPersistence();
      const orderLabel = cartItems.map((i) => i.name).join(", ");
      const pointsUsed = usePoints
        ? Math.ceil((total + deliveryFee) / CREDIT_PER_POINT)
        : 0;

      // Handle mobile payment with Flashpay
      let paymentData = null;
      if (normalizedPayment?.id === "payment_mobile" && !usePoints) {
        if (!isOnline) {
          throw new Error(
            "Connexion Internet requise pour le paiement mobile."
          );
        }

        // Initialize Flashpay token
        await appInit();

        // Initialize Flashpay transaction
        const successUrl =
          "https://papersbook-f3826.firebaseapp.com/order-success";
        const failureUrl =
          "https://papersbook-f3826.firebaseapp.com/order-failed";
        // paymentData = await initTrx(
        //   total + deliveryFee,
        //   `Commande : ${orderLabel}`,
        //   successUrl,
        //   failureUrl
        // );
        // Authentification
        const authParams = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: "api-000003-cc",
          client_secret: "AC1HRSNpPp0Wd6SVk4rClJna8nrmtpr2",
        });
        const authResponse = await fetch(
          "https://auth.seed-apps.com/realms/flashpay/protocol/openid-connect/token",
          {
            method: "POST",
            body: authParams.toString(),
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        if (!authResponse.ok) {
          throw new Error(`Erreur HTTP ${authResponse.status}`);
        }
        console.log("Auth response:", authResponse);

        const authData = await authResponse.json();
        const token = authData.access_token;

        const response = await fetch(
          "https://flashup.seed-apps.com/rest/api/v1/payments/init",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              amount: total + deliveryFee,
              description: `Commande : ${orderLabel}`,
              success_url: successUrl,
              failure_url: failureUrl,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          // return res
          //   .status(response.status)
          //   .json({
          //     error:
          //       errorData.error_details?.[0]?.message ||
          //       "Erreur lors de l'initialisation",
          //   });
        }

        const paymentData = await response.json();
        // return res.status(200).json({
        //   payment_url: data.payment_url,
        //   code: data.transaction_code,
        // });
        // Handle Flashpay response
        if (paymentData.payment_url) {
          // Redirect to payment URL
          window.location.href = paymentData.payment_url;
          return;
        } else if (paymentData.code) {
          // Store pending order with transaction code
          paymentData.transactionId = paymentData.code;
        } else {
          throw new Error(
            "Réponse Flashpay invalide : aucune URL ou code de transaction."
          );
        }
      }

      // Save order
      const data = {
        userId: uid,
        items: cartItems.map((i) => ({
          dishId: i.id,
          quantity: i.quantity,
          price: convertPrice(i.price),
          selectedExtras: i.selectedExtras || null,
        })),
        address: normalizedAddress,
        paymentMethod: normalizedPayment,
        total: total + deliveryFee,
        deliveryFee,
        pointsUsed,
        loyaltyPoints,
        loyaltyEligible: true,
        status:
          normalizedPayment?.id === "payment_mobile" &&
          paymentData?.transactionId
            ? "pending"
            : "en_attente",
        isPaid:
          normalizedPayment?.id === "cash_delivery"
            ? false
            : !paymentData?.transactionId,
        timestamp: Timestamp.now(),
        isGuest: !!isGuest,
        label: orderLabel,
        paymentRef: paymentData?.transactionId || null,
      };

      if (isGuest && contact) {
        data.contact = { name: contact.name, phone: contact.phone };
      }

      const orderRef = await addDoc(collection(db, "orders"), data);

      // Save notifications and points transactions
      await Promise.all(
        [
          addDoc(collection(db, "notifications"), {
            orderId: orderRef.id,
            newStatus: data.status,
            timestamp: Timestamp.now(),
            userId: uid,
            restaurantId: cartItems[0]?.restaurantId || "",
            read: false,
            message: `Nouvelle commande #${orderRef.id.slice(0, 6)}${
              usePoints ? " (paiement avec points)" : ""
            }`,
            type: usePoints ? "points_payment" : "new_order",
          }),
          usePoints &&
            addDoc(collection(db, "pointsTransactions"), {
              userId: uid,
              orderId: orderRef.id,
              pointsAmount: pointsUsed,
              status: "pending",
              timestamp: Timestamp.now(),
              read: false,
              message: `Demande d'utilisation de ${formatPrice(
                pointsUsed
              )} pts pour commande #${orderRef.id.slice(0, 6)}`,
              type: "points_approval",
            }),
          loyaltyPoints > 0 &&
            !isGuest &&
            addDoc(collection(db, "pointsTransactions"), {
              userId: uid,
              orderId: orderRef.id,
              pointsAmount: loyaltyPoints,
              status: "pending",
              timestamp: Timestamp.now(),
              read: false,
              message: `Demande d'octroi de ${formatPrice(
                loyaltyPoints
              )} pts pour commande #${orderRef.id.slice(
                0,
                6
              )} après confirmation du paiement`,
              type: "points_grant",
            }),
        ].filter(Boolean)
      );

      clearCart();
      navigate("/complete_order", {
        state: {
          orderId: orderRef.id,
          isGuest,
          paymentRef: paymentData?.transactionId,
        },
      });
    } catch (err) {
      console.error("Erreur lors de la soumission:", err);
      if (err.code === "unavailable") {
        setError(
          "Vous êtes hors ligne. La commande sera synchronisée lorsque vous serez connecté."
        );
      } else {
        setError(
          err.message ||
            "Erreur lors de la soumission de la commande. Veuillez vérifier votre connexion ou réessayer."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [
    cartItems,
    normalizedAddress,
    normalizedPayment,
    total,
    deliveryFee,
    usePoints,
    isGuest,
    contact,
    clearCart,
    navigate,
    loyaltyPoints,
    isOnline,
  ]);

  if (
    dataLoading ||
    !cartItems ||
    cartItems.length === 0 ||
    missingData ||
    !isValidOrder()
  ) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          {dataLoading && <p>Chargement des données...</p>}
          {!cartItems && (
            <p className="text-red-600 mb-4">Votre panier est vide.</p>
          )}
          {missingData && (
            <p className="text-red-600 mb-4">
              Informations de commande manquantes.
            </p>
          )}
          {!isValidOrder() && (
            <p className="text-red-600 mb-4">Données de commande invalides.</p>
          )}
          <p>Redirection en cours...</p>
        </div>
      </div>
    );
  }

  const canUsePoints =
    userPoints >=
      Math.ceil(
        (total + getDeliveryFee(normalizedAddress?.area)) / CREDIT_PER_POINT
      ) && !isGuest;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white border-b p-3 sticky top-0 z-10">
        <h2 className="text-center font-bold text-xl">Récapitulatif</h2>
      </header>
      <div className="p-3">
        {!isOnline && (
          <div
            className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4"
            role="alert"
          >
            <span className="block sm:inline">
              Vous êtes hors ligne. Certaines actions seront synchronisées
              lorsque vous serez connecté.
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
            <h6 className="font-bold text-gray-800 mb-2">
              Adresse de livraison :
            </h6>
            <div className="text-sm text-gray-700">
              <p>
                <span className="font-medium">Type :</span>{" "}
                {normalizedAddress?.nickname}
              </p>
              <p>
                <span className="font-medium">Ville :</span> YAOUNDE
              </p>
              <p>
                <span className="font-medium">Quartier :</span>{" "}
                {normalizedAddress?.area}
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
            <h6 className="font-bold text-gray-800 mb-2">
              Méthode de paiement :
            </h6>
            <div className="flex items-center">
              <i
                className={`${normalizedPayment?.icon} text-green-600 text-xl mr-3`}
              ></i>
              <div>
                <p className="font-semibold">{normalizedPayment?.name}</p>
                <p className="text-sm text-gray-500">
                  {normalizedPayment?.description}
                </p>
                {normalizedPayment?.phone && (
                  <p className="text-sm text-gray-500">
                    Numéro: {normalizedPayment.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
          {!isGuest && userPoints > 0 && (
            <div className="mb-4 bg-gray-50 p-3 rounded-lg">
              <h6 className="font-bold text-gray-800 mb-2">
                Points de fidélité
              </h6>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    Vos points : {formatPrice(userPoints)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {canUsePoints
                      ? "Vous pouvez payer cette commande avec vos points"
                      : "Points insuffisants pour payer cette commande"}
                  </p>
                </div>
                {canUsePoints && (
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usePoints}
                      onChange={(e) => setUsePoints(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    <span className="ms-3 text-sm font-medium text-gray-900">
                      {usePoints ? "Utiliser mes points" : "Payer normalement"}
                    </span>
                  </label>
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
                Les points seront crédités sur votre compte une fois le paiement
                validé par notre équipe.
              </p>
            )}
          </div>
          <h6 className="font-bold text-gray-800 mb-2">Articles commandés :</h6>
          {cartItems.map((item) => (
            <div
              key={`${item.id}-${JSON.stringify(item.selectedExtras)}`}
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
                      {convertPrice(item.price).toLocaleString()} Fcfa ×{" "}
                      {item.quantity}
                    </p>
                  </div>
                  {item.selectedExtras && (
                    <div className="mt-1 text-sm text-gray-600">
                      {Object.entries(item.selectedExtras).map(
                        ([extraListId, indexes]) => (
                          <div key={extraListId} className="mb-1">
                            <span className="font-medium">
                              {
                                extraLists.find((el) => el.id === extraListId)
                                  ?.name
                              }{" "}
                              :
                            </span>
                            {indexes.map((index) => (
                              <div key={index} className="ml-2">
                                {getExtraName(extraListId, index)}
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {!usePoints && (
          <div className="bg-gray-50 p-3 rounded-lg mb-4">
            <h6 className="font-bold text-gray-800 mb-2">Frais de livraison</h6>
            <p className="text-sm">
              {normalizedAddress?.area
                ? `${normalizedAddress.area} : ${formatPrice(
                    getDeliveryFee(normalizedAddress.area)
                  )} Fcfa`
                : `Inconnu : ${formatPrice(DEFAULT_DELIVERY_FEE)} Fcfa`}
            </p>
            <p className="text-xs text-gray-600">
              NB: Ce prix est défini selon le quartier et peut être ajusté par
              un gestionnaire si l'accès est difficile.
            </p>
          </div>
        )}
        <div className="bg-white p-3 rounded shadow-sm">
          <div className="flex justify-between font-bold text-lg">
            <span>Total :</span>
            <span className="text-green-600">
              {isNaN(total) || extraLists.length === 0
                ? "Calcul en cours..."
                : formatPrice(total + (usePoints ? 0 : deliveryFee)) + " Fcfa"}
            </span>
          </div>
          {usePoints && (
            <div className="mt-2 text-sm text-gray-600">
              <p>
                <span className="font-semibold">Points utilisés :</span>{" "}
                {formatPrice(
                  Math.ceil(
                    (total + getDeliveryFee(normalizedAddress?.area)) /
                      CREDIT_PER_POINT
                  )
                )}
              </p>
              <p className="text-xs">
                Votre demande sera soumise à approbation. Les points seront
                déduits après confirmation par l'admin.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 shadow-lg">
        <button
          onClick={handleConfirmOrder}
          disabled={
            loading || (!isOnline && normalizedPayment?.id === "payment_mobile")
          }
          aria-label={
            loading
              ? "Validation en cours"
              : usePoints
              ? "Confirmer avec points"
              : "Confirmer la commande"
          }
          className={`w-full py-3 text-white rounded-lg transition-colors ${
            loading || (!isOnline && normalizedPayment?.id === "payment_mobile")
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
              Validation en cours...
            </span>
          ) : usePoints ? (
            "Confirmer avec mes points"
          ) : (
            "Confirmer la commande"
          )}
        </button>
      </div>
    </div>
  );
};

export default OrderSummary;