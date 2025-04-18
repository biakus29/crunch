import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/cartcontext";
import { auth, db } from "../firebase";
import { addDoc, collection, getDocs, getDoc, Timestamp } from "firebase/firestore";

const DEFAULT_DELIVERY_FEE = 1000;

const OrderSummary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartItems } = useCart();
  const [extraLists, setExtraLists] = useState([]);
  const [quartiersList, setQuartiersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [missingData, setMissingData] = useState(false);

  const { selectedAddress, selectedPayment, contact, orderData, isGuest, deliveryFee: passedDeliveryFee } = location.state || {};

  const normalizedAddress = useMemo(() => {
    if (isGuest && orderData?.address) {
      console.log("Utilisation de l'adresse invité:", orderData.address);
      return orderData.address;
    }
    console.log("Utilisation de l'adresse sélectionnée:", selectedAddress);
    return selectedAddress;
  }, [isGuest, orderData, selectedAddress]);

  const normalizedPayment = useMemo(() => {
    if (isGuest && orderData?.paymentMethod) return orderData.paymentMethod;
    return selectedPayment;
  }, [isGuest, orderData, selectedPayment]);

  // Vérifier si le panier est vide
  useEffect(() => {
    if (!cartItems || cartItems.length === 0) {
      setError("Votre panier est vide. Redirection vers la page d'accueil...");
      const timer = setTimeout(() => navigate("/"), 2000);
      return () => clearTimeout(timer);
    }
  }, [cartItems, navigate]);

  // Charger les frais de livraison depuis la collection "quartiers"
  useEffect(() => {
    const fetchQuartiers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "quartiers"));
        setQuartiersList(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Erreur chargement des quartiers:", error);
      }
    };
    fetchQuartiers();
  }, []);

  // Vérifier les données manquantes (adresse ou paiement)
  useEffect(() => {
    if (!normalizedAddress || !normalizedPayment) {
      setMissingData(true);
      const timer = setTimeout(() => navigate("/cart"), 2000);
      return () => clearTimeout(timer);
    }
  }, [normalizedAddress, normalizedPayment, navigate]);

  useEffect(() => {
    const fetchExtraLists = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "extraLists"));
        setExtraLists(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Erreur chargement extras:", err);
      }
    };
    fetchExtraLists();
  }, []);

  const convertPrice = (price) => {
    if (typeof price === "string") {
      return parseFloat(price.replace(/\./g, ""));
    }
    return Number(price);
  };

  const total = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      let itemTotal = convertPrice(item.price) * item.quantity;
      if (item.selectedExtras) {
        Object.entries(item.selectedExtras).forEach(([extraListId, indexes]) => {
          const extraList = extraLists.find((el) => el.id === extraListId);
          if (extraList) {
            indexes.forEach((index) => {
              const element = extraList.extraListElements?.[index];
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

  const getExtraName = (extraListId, index) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    const element = extraList?.extraListElements?.[index];
    return element
      ? `${element.name}${element.price ? ` (+${convertPrice(element.price).toLocaleString()} Fcfa)` : ""}`
      : "Extra inconnu";
  };

  // Récupérer dynamiquement le frais de livraison selon le quartier
  const getDeliveryFee = (area) => {
    if (passedDeliveryFee) return Number(passedDeliveryFee); // Priorité aux frais passés via state
    if (!area || quartiersList.length === 0) return DEFAULT_DELIVERY_FEE;
    const quartier = quartiersList.find((q) => q.name.toLowerCase() === area.toLowerCase());
    return quartier ? Number(quartier.fee) : DEFAULT_DELIVERY_FEE;
  };

  const formatPrice = (number) =>
    Number(number).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const handleConfirmOrder = async () => {
    setLoading(true);
    setError("");
    const guestUid = localStorage.getItem("guestUid");

    try {
      const deliveryFee = getDeliveryFee(normalizedAddress?.area);
      const orderLabel = cartItems.map((item) => item.name).join(", ");

      const orderDataToSave = {
        userId: auth.currentUser ? auth.currentUser.uid : guestUid,
        items: cartItems.map((item) => ({
          dishId: item.id,
          quantity: item.quantity,
          restaurantId: item.restaurantId,
          selectedExtras: item.selectedExtras || null,
          dishName: item.name,
          dishPrice: convertPrice(item.price),
        })),
        destination: normalizedAddress?.completeAddress || "",
        address: {
          nickname: normalizedAddress?.nickname || "",
          area: normalizedAddress?.area || "",
          completeAddress: normalizedAddress?.completeAddress || "",
          instructions: normalizedAddress?.instructions || "",
          phone: normalizedAddress?.phone || contact?.phone || "",
        },
        paymentMethod: {
          id: normalizedPayment?.id || "",
          name: normalizedPayment?.name || "",
          description: normalizedPayment?.description || "",
          icon: normalizedPayment?.icon || "",
        },
        total: total + deliveryFee,
        deliveryFee: deliveryFee,
        status: "en_attente",
        timestamp: Timestamp.now(),
        isGuest: !!isGuest,
        label: orderLabel,
      };

      if (isGuest && contact) {
        orderDataToSave.contact = {
          name: contact.name,
          phone: contact.phone,
        };
      }

      const docRef = await addDoc(collection(db, "orders"), orderDataToSave);

      // Création d'une notification pour l'administrateur
      const restaurantId = cartItems[0]?.restaurantId || "default_restaurant_id";
      const notificationData = {
        orderId: docRef.id,
        oldStatus: null,
        newStatus: "en_attente",
        timestamp: Timestamp.now(),
        userId: orderDataToSave.userId || "unknown",
        restaurantId: restaurantId,
        read: false,
        message: `Nouvelle commande #${docRef.id.slice(0, 6)} reçue`,
        type: "new_order",
        itemNames: orderLabel,
      };

      await addDoc(collection(db, "notifications"), notificationData);
      console.log(`Notification envoyée pour la commande ${docRef.id}`);

      navigate("/complete_order", {
        state: {
          orderId: docRef.id,
          order: orderDataToSave,
          isGuest,
        },
      });
    } catch (err) {
      console.error("Erreur lors de la commande:", err);
      setError("Erreur lors de la commande. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  // Afficher un message si le panier est vide ou s'il manque des données
  if (!cartItems || cartItems.length === 0 || missingData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          {(!cartItems || cartItems.length === 0) && (
            <>
              <p className="text-red-600 mb-4">Votre panier est vide</p>
              <p>Redirection vers la page d'accueil...</p>
            </>
          )}
          {missingData && (
            <>
              <p className="text-red-600 mb-4">Informations de commande manquantes</p>
              <p>Redirection vers votre panier...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white border-b p-3 sticky top-0 z-10">
        <h2 className="text-center font-bold text-xl">Récapitulatif</h2>
      </header>

      <div className="p-3">
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
                <span className="font-medium">Description :</span> {normalizedAddress?.completeAddress}
              </p>
              {normalizedAddress?.instructions && (
                <p>
                  <span className="font-medium">Instructions :</span> {normalizedAddress.instructions}
                </p>
              )}
              <p>
                <span className="font-medium">Téléphone :</span> {normalizedAddress?.phone || contact?.phone}
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
              <i className={`${normalizedPayment?.icon} text-green-600 text-xl mr-3`}></i>
              <div>
                <p className="font-semibold">{normalizedPayment?.name}</p>
                <p className="text-sm text-gray-500">{normalizedPayment?.description}</p>
              </div>
            </div>
          </div>

          <h6 className="font-bold text-gray-800 mb-2">Articles commandés :</h6>
          {cartItems.map((item) => (
            <div key={`${item.id}-${JSON.stringify(item.selectedExtras)}`} className="border-b py-3 last:border-b-0">
              <div className="flex items-start">
                <img
                  src={item.covers?.[0] || "/img/default.png"}
                  alt={item.name}
                  className="w-16 h-16 object-cover rounded mr-3"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/img/default.png";
                  }}
                />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h5 className="font-semibold">{item.name}</h5>
                    <p className="text-green-600">
                      {convertPrice(item.price).toLocaleString()} Fcfa × {item.quantity}
                    </p>
                  </div>
                  {item.selectedExtras && (
                    <div className="mt-1 text-sm text-gray-600">
                      {Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
                        <div key={extraListId} className="mb-1">
                          <span className="font-medium">
                            {extraLists.find((el) => el.id === extraListId)?.name} :
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

        {/* Bloc pour afficher dynamiquement les frais de livraison */}
        <div className="bg-gray-50 p-3 rounded-lg mb-4">
          <h6 className="font-bold text-gray-800 mb-2">Frais de livraison</h6>
          <p className="text-sm">
            {normalizedAddress?.area
              ? `${normalizedAddress.area} : ${formatPrice(getDeliveryFee(normalizedAddress.area))} Fcfa`
              : `Inconnu : ${formatPrice(DEFAULT_DELIVERY_FEE)} Fcfa`}
          </p>
          <p className="text-xs text-gray-600">
            NB: Ce prix est défini selon le quartier et peut être ajusté par un gestionnaire si l'accès est difficile.
          </p>
        </div>

        <div className="bg-white p-3 rounded shadow-sm">
          <div className="flex justify-between font-bold text-lg">
            <span>Total :</span>
            <span className="text-green-600">
              {isNaN(total) ? "Calcul..." : formatPrice(total + getDeliveryFee(normalizedAddress?.area))} Fcfa
            </span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 shadow-lg">
        {error && <p className="mb-2 text-center text-red-600 text-sm">{error}</p>}
        <button
          onClick={handleConfirmOrder}
          disabled={loading}
          className={`w-full py-3 text-white rounded-lg transition-colors ${
            loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Validation en cours...
            </span>
          ) : "Confirmer la commande"}
        </button>
      </div>
    </div>
  );
};

export default OrderSummary;