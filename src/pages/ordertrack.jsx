
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import ThankYouPage from "./thankyou";
import { normalizePhone } from "../utils/phoneutils";

// Constantes pour cohérence avec OrderStatus.jsx
export const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  READY_TO_DELIVER: "pret_a_livrer",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  CANCELLED: "annulee",
  FAILED: "echec",
};

export const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "En attente",
  [ORDER_STATUS.PREPARING]: "En préparation",
  [ORDER_STATUS.DELIVERING]: "En livraison",
  [ORDER_STATUS.DELIVERED]: "Livrée",
  [ORDER_STATUS.CANCELLED]: "Annulée",
  [ORDER_STATUS.FAILED]: "Échec",
};

export const STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-yellow-500 text-white",
  [ORDER_STATUS.PREPARING]: "bg-blue-500 text-white",
  [ORDER_STATUS.DELIVERING]: "bg-orange-500 text-white",
  [ORDER_STATUS.DELIVERED]: "bg-green-600 text-white",
  [ORDER_STATUS.CANCELLED]: "bg-red-600 text-white",
  [ORDER_STATUS.FAILED]: "bg-gray-600 text-white",
};

export const STATUS_COMMENTS = {
  [ORDER_STATUS.PENDING]: "Commande en attente d’être validée",
  [ORDER_STATUS.PREPARING]: "Un livreur vous appelera dès que votre commande sera prête",
  [ORDER_STATUS.DELIVERING]: "Commande en route pour la livraison",
  [ORDER_STATUS.DELIVERED]: "Commande livrée avec succès",
  [ORDER_STATUS.CANCELLED]: "Commande annulée",
  [ORDER_STATUS.FAILED]: "La livraison a échoué (contactez le support)",
};

const DEFAULT_DELIVERY_FEE = 1000;

// Fonction pour normaliser les prix
const convertPrice = (price) => {
  if (!price || price === undefined || price === null) return 0;
  try {
    if (typeof price === 'string') {
      return parseFloat(price.replace(/\./g, '')) || 0;
    }
    return Number(price) || 0;
  } catch (err) {
    console.warn('Erreur dans convertPrice:', price, err);
    return 0;
  }
};

export const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const formatDate = (timestamp) =>
  timestamp?.seconds
    ? new Date(timestamp.seconds * 1000).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Date non disponible";

const OrderTracking = () => {
  const { numeroTelephoneClient } = useParams();
  const [phone, setPhone] = useState(numeroTelephoneClient || "");
  const [orders, setOrders] = useState([]);
  const [itemsData, setItemsData] = useState({});
  const [extraLists, setExtraLists] = useState({});
  const [usersData, setUsersData] = useState({ byId: {}, byPhone: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const navigate = useNavigate();

  const fetchReferenceData = async () => {
    try {
      const [items, extras, users] = await Promise.all([
        getDocs(collection(db, "items")),
        getDocs(collection(db, "extraLists")),
        getDocs(collection(db, "usersRestau")),
      ]);
      setItemsData(items.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
      setExtraLists(extras.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
      setUsersData({
        byId: users.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}),
        byPhone: users.docs.reduce((acc, doc) => {
          if (doc.data().phone) {
            const normalizedPhones = normalizePhone(doc.data().phone);
            normalizedPhones.forEach((phone) => {
              acc[phone] = doc.data();
            });
          }
          return acc;
        }, {}),
      });
    } catch (err) {
      console.error("Erreur de chargement des données de référence:", err);
      setError("Erreur de chargement des données de référence");
    }
  };

  const confirmDelivery = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: ORDER_STATUS.DELIVERED,
        updatedAt: new Date(),
      });
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId
            ? { ...order, status: ORDER_STATUS.DELIVERED, updatedAt: new Date() }
            : order
        )
      );
      setNotification({ message: "Commande confirmée comme livrée !", type: "success" });
      setTimeout(() => setNotification({ message: "", type: "" }), 3000);
    } catch (err) {
      console.error("Erreur lors de la confirmation de livraison:", err);
      setNotification({ message: "Échec de la confirmation. Réessayez.", type: "error" });
      setTimeout(() => setNotification({ message: "", type: "" }), 3000);
    }
  };

  useEffect(() => {
    if (!phone) {
      setError("Veuillez entrer un numéro de téléphone.");
      setLoading(false);
      return;
    }

    const phoneVariations = normalizePhone(phone);
    if (!phoneVariations.some((v) => v.length >= 9)) {
      setError("Veuillez entrer un numéro de téléphone valide (minimum 9 chiffres, ex: +237123456789).");
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    fetchReferenceData().then(() => {
      const queries = phoneVariations.flatMap((v) => [
        query(collection(db, "orders"), where("contact.phone", "==", v)),
        query(collection(db, "orders"), where("address.phone", "==", v)), // Compatibilité avec anciennes commandes
      ]);

      const fetchedOrders = [];
      const unsubscribes = queries.map((q, index) =>
        onSnapshot(
          q,
          (snapshot) => {
            snapshot.docs.forEach((doc) => {
              const data = doc.data();
              const order = {
                id: doc.id,
                ...data,
                status: data.status || ORDER_STATUS.PENDING,
              };
              if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
                console.warn(`Commande ${doc.id} ignorée : items invalides`, order);
                return;
              }
              if (!fetchedOrders.find((o) => o.id === order.id)) {
                fetchedOrders.push(order);
              }
            });
            fetchedOrders.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setOrders([...fetchedOrders]);
            setLoading(false);
          },
          (err) => {
            console.error(`Erreur pour phone variation "${phoneVariations[Math.floor(index / 2)]}" :`, err);
            setError("Aucune commande trouvée. Vérifiez votre numéro (ex: +237123456789).");
            setLoading(false);
          }
        )
      );

      return () => unsubscribes.forEach((unsub) => unsub());
    });
  }, [phone]);

  const handlePhoneChange = (e) => {
    const newPhone = e.target.value;
    setPhone(newPhone);
    const phoneVariations = normalizePhone(newPhone);
    const validPhone = phoneVariations.find((v) => v.length >= 9);
    if (validPhone) {
      navigate(`/commande/me/${encodeURIComponent(validPhone)}`);
      setSelectedOrderId(null);
    }
  };

  const calculateTotal = (order) => {
    if (!order || !Array.isArray(order.items)) {
      console.warn("Commande invalide ou sans articles:", order);
      return 0;
    }

    const itemsTotal = order.items.reduce((sum, item) => {
      const currentItem = itemsData[item.dishId] || {};
      const isSizeBased = currentItem?.priceType === "sizes" && item.size && currentItem?.sizes?.[item.size];

      // Déterminer le prix de l'article
      let itemPrice = 0;
      if (item.price !== undefined && !isNaN(convertPrice(item.price))) {
        itemPrice = convertPrice(item.price); // Utiliser item.price (nouveau format)
      } else if (item.dishPrice !== undefined && !isNaN(convertPrice(item.dishPrice))) {
        itemPrice = convertPrice(item.dishPrice); // Compatibilité avec ancien format
      } else if (isSizeBased) {
        itemPrice = convertPrice(currentItem.sizes[item.size]); // Fallback pour articles à taille
      } else {
        itemPrice = convertPrice(currentItem.price || 0); // Fallback pour prix standard
      }

      // Calculer le total des extras
      const extrasTotal = item.selectedExtras
        ? Object.entries(item.selectedExtras).reduce((extraSum, [extraListId, indexes]) => {
            const extraList = extraLists[extraListId]?.extraListElements || [];
            return extraSum + indexes.reduce((acc, index) => {
              const extraPrice = convertPrice(extraList[index]?.price || 0);
              return acc + extraPrice;
            }, 0);
          }, 0)
        : item.extras && Array.isArray(item.extras)
        ? item.extras.reduce((extraSum, extra) => extraSum + convertPrice(extra.price || 0), 0)
        : 0;

      // Log pour débogage
      console.log(`Calcul pour article ${item.dishId}:`, {
        itemPrice,
        isSizeBased,
        size: item.size,
        quantity: item.quantity,
        extrasTotal,
        total: (itemPrice + extrasTotal) * Number(item.quantity || 1),
      });

      return sum + (itemPrice + extrasTotal) * Number(item.quantity || 1);
    }, 0);

    const deliveryFee = convertPrice(order.deliveryFee) || DEFAULT_DELIVERY_FEE;
    const pointsReduction = convertPrice(order.pointsReduction) || 0;
    const total = Math.max(0, itemsTotal + deliveryFee - pointsReduction);

    console.log(`Total commande ${order.id}:`, {
      itemsTotal,
      deliveryFee,
      pointsReduction,
      total,
    });

    return total;
  };

  const getSteps = (order) => {
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
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrderId(selectedOrderId === orderId ? null : orderId);
  };

  const renderOrderDetails = (order) => {
    const user = order.userId
      ? usersData.byId[order.userId]
      : order.contact?.phone && usersData.byPhone[order.contact?.phone];
    const clientName =
      user
        ? `${user.lastName || ""} ${user.firstName || ""} ${user.email || ""}`.trim() || "Utilisateur inconnu"
        : order.contact?.name || "Client inconnu";
    const phoneNumber = user?.phone || order.contact?.phone || order.address?.phone || "Non fourni";

    return (
      <div className="mt-4 space-y-4">
        {/* En-tête de la commande */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <i className="fas fa-shopping-bag text-xl sm:text-2xl text-blue-600"></i>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800">Commande #{order.id.slice(0, 8)}</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <i className="fas fa-user text-gray-500 text-sm sm:text-base"></i>
                <span className="text-sm sm:text-base font-medium text-gray-700">{clientName}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-phone text-gray-500 text-sm sm:text-base"></i>
                <span className="text-xs sm:text-sm text-gray-600">{phoneNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-clock text-gray-500 text-sm sm:text-base"></i>
                <span className="text-xs sm:text-sm text-gray-600">Commandé le {formatDate(order.timestamp)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <i className="fas fa-map-pin text-gray-500 text-sm sm:text-base mt-1"></i>
                <div className="text-xs sm:text-sm">
                  <p className="font-medium text-gray-700">Adresse de livraison :</p>
                  <p className="text-gray-600">
                    {order.address?.completeAddress || "Non spécifié"}<br />
                    {order.address?.area || "Non spécifié"}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {(order.pointsUsed > 0 || order.loyaltyPoints > 0) && (
            <div className="mt-4 bg-gray-50 p-3 sm:p-4 rounded-lg">
              <h4 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">Points de fidélité</h4>
              {order.pointsUsed > 0 && (
                <p className="text-xs sm:text-sm text-gray-600">
                  Utilisé : {formatPrice(order.pointsUsed)} points (-{formatPrice(order.pointsReduction)} FCFA)
                </p>
              )}
              {order.loyaltyPoints > 0 && (
                <p className="text-xs sm:text-sm text-gray-600">
                  Gagné : {formatPrice(order.loyaltyPoints)} points (crédités après validation)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Timeline de suivi */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Suivi de votre commande</h3>
          <div className="relative pl-6 sm:pl-8">
            {getSteps(order).map((step, index) => {
              const isLast = index === getSteps(order).length - 1;
              const getStepIcon = () => {
                if (step.stepStatus === "completed")
                  return (
                    <i className="fas fa-check-circle absolute -left-6 sm:-left-8 top-0 text-lg sm:text-xl text-green-500"></i>
                  );
                return (
                  <div className="absolute -left-6 sm:-left-8 top-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-200 border-2 border-gray-300"></div>
                );
              };

              return (
                <div
                  key={step.id}
                  className={`relative pb-6 sm:pb-8 ${isLast ? "pb-0" : ""}`}
                >
                  {getStepIcon()}
                  <div className={`pl-4 sm:pl-6 ${!isLast ? "border-l-2 border-gray-200" : ""}`}>
                    <h4
                      className={`font-semibold text-sm sm:text-base mb-1 ${
                        step.stepStatus === "completed" ? "text-green-700" : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </h4>
                    <p
                      className={`text-xs sm:text-sm mb-2 ${
                        step.stepStatus === "completed" ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {step.description}
                    </p>
                    {step.timestamp && (
                      <p className="text-xs text-gray-400">
                        {new Date(step.timestamp).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    {step.status === ORDER_STATUS.DELIVERING && step.stepStatus === "completed" && (
                      <button
                        onClick={() => confirmDelivery(order.id)}
                        className="mt-2 px-3 sm:px-4 py-1 sm:py-2 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                        aria-label="Confirmer la livraison"
                      >
                        Confirmer la livraison
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notation */}
        {order.status === ORDER_STATUS.DELIVERED && order.id && (
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <ThankYouPage order={order} />
          </div>
        )}

        {/* Articles commandés */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Articles commandés</h3>
          <div className="space-y-4">
            {order.items.map((item, index) => {
              const currentItem = itemsData[item.dishId] || {};
              const isSizeBased = currentItem?.priceType === "sizes" && item.size;
              const itemPrice =
                item.price !== undefined && !isNaN(convertPrice(item.price))
                  ? convertPrice(item.price)
                  : item.dishPrice !== undefined && !isNaN(convertPrice(item.dishPrice))
                  ? convertPrice(item.dishPrice)
                  : isSizeBased
                  ? convertPrice(currentItem.sizes?.[item.size] || 0)
                  : convertPrice(currentItem.price || 0);

              return (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex-1 mb-2 sm:mb-0">
                    <h5 className="font-medium text-sm sm:text-base text-gray-900">
                      {item.dishName || currentItem.name || "Article inconnu"}
                      {isSizeBased ? ` (${item.size})` : ""}
                    </h5>
                    <p className="text-xs sm:text-sm text-gray-600">Quantité : {item.quantity}</p>
                    {(item.selectedExtras || item.extras) && (
                      <div className="ml-2 sm:ml-4 mt-2 text-xs sm:text-sm text-gray-600">
                        {item.selectedExtras &&
                          Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
                            <div key={extraListId}>
                              <p className="font-medium">{extraLists[extraListId]?.name || "Options"} :</p>
                              <ul className="list-disc list-inside ml-2">
                                {indexes.map((index) => {
                                  const extra = extraLists[extraListId]?.extraListElements?.[index] || {};
                                  return (
                                    <li key={index} className="flex justify-between">
                                      <span>{extra.name || "Option supprimée"}</span>
                                      {extra.price > 0 && (
                                        <span className="text-green-500 ml-2">
                                          +{formatPrice(convertPrice(extra.price) * item.quantity)} FCFA
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        {item.extras &&
                          Array.isArray(item.extras) &&
                          item.extras.map((extra, idx) => (
                            <div key={idx}>
                              <p className="font-medium">Extras :</p>
                              <ul className="list-disc list-inside ml-2">
                                <li className="flex justify-between">
                                  <span>{extra.name || "Option inconnue"}</span>
                                  {extra.price > 0 && (
                                    <span className="text-green-500 ml-2">
                                      +{formatPrice(convertPrice(extra.price) * item.quantity)} FCFA
                                    </span>
                                  )}
                                </li>
                              </ul>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm sm:text-base text-gray-900">
                      {formatPrice(itemPrice * item.quantity)} FCFA
                    </p>
                  </div>
                </div>
              );
            })}
            <div className="pt-4 border-t-2 border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg font-semibold text-gray-800">Total</span>
                <span className="text-lg sm:text-xl font-bold text-blue-600">
                  {formatPrice(calculateTotal(order))} FCFA
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16 sm:pb-20">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <h2 className="text-center font-bold text-xl sm:text-2xl py-3 sm:py-4 text-gray-800">
          Suivi de mes commandes
        </h2>
      </header>

      {/* Main Content */}
      <div className="p-3 sm:p-4 max-w-4xl mx-auto">
        {/* Notification */}
        {notification.message && (
          <div
            className={`fixed bottom-20 sm:top-4 sm:right-4 p-3 sm:p-4 rounded-lg text-white shadow-lg w-11/12 sm:w-auto mx-auto sm:mx-0 ${
              notification.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
            role="alert"
          >
            {notification.message}
          </div>
        )}

        {/* Phone Input */}
        <div className="mb-4 sm:mb-6 bg-white rounded-xl shadow-md p-3 sm:p-4">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Numéro de téléphone
          </label>
          <div className="relative">
            <i className="fas fa-phone absolute left-3 sm:left-3 top-1/2 transform -translate-y-1/2 text-sm sm:text-base text-gray-400"></i>
            <input
              type="text"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="Entrez votre numéro (ex. : +237123456789)"
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm sm:text-base"
              aria-label="Numéro de téléphone"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-3 sm:space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-md p-3 sm:p-4 animate-pulse">
                <div className="h-4 sm:h-6 bg-gray-200 rounded w-1/3 mb-2 sm:mb-4"></div>
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2 mb-1 sm:mb-2"></div>
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <p className="text-center text-red-600 text-sm sm:text-base p-3 sm:p-4 bg-red-50 rounded-lg" role="alert">
            {error}
          </p>
        )}

        {/* No Orders */}
        {!loading && orders.length === 0 && (
          <p className="text-center text-gray-500 text-sm sm:text-base p-3 sm:p-4 bg-white rounded-xl shadow-md">
            Aucune commande trouvée pour ce numéro. Essayez avec un autre format (ex: +237123456789).
          </p>
        )}

        {/* Orders List */}
        {!loading && orders.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl shadow-md p-3 sm:p-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Vos commandes</h3>
              <div className="space-y-3 sm:space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 sm:p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer rounded-lg"
                    onClick={() => handleSelectOrder(order.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleSelectOrder(order.id)}
                  >
                    <div className="mb-2 sm:mb-0">
                      <h4 className="font-medium text-sm sm:text-base text-gray-900">
                        Commande #{order.id.slice(0, 8)}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-600">{formatDate(order.timestamp)}</p>
                      <p
                        className={`text-xs sm:text-sm ${STATUS_COLORS[order.status] || "bg-gray-500 text-white"} px-2 py-1 rounded-full inline-block mt-1`}
                      >
                        {STATUS_LABELS[order.status] || "Statut inconnu"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm sm:text-base text-gray-900">
                        {formatPrice(calculateTotal(order))} FCFA
                      </p>
                      <button
                        className="text-blue-600 text-xs sm:text-sm hover:underline focus:outline-none mt-1 sm:mt-0"
                        aria-label={selectedOrderId === order.id ? "Masquer les détails" : "Voir les détails"}
                      >
                        {selectedOrderId === order.id ? "Masquer" : "Voir les détails"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Selected Order Details */}
            {selectedOrderId && orders.find((order) => order.id === selectedOrderId) && (
              renderOrderDetails(orders.find((order) => order.id === selectedOrderId))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

const Footer = () => (
  <footer className="fixed bottom-0 w-full bg-white border-t shadow-md z-50">
    <div className="grid grid-cols-4 max-w-4xl mx-auto">
      {[
        { to: "/accueil", icon: "fas fa-home", label: "Accueil" },
        { to: "/cart", icon: "fas fa-shopping-cart", label: "Panier" },
        { to: "/complete_order", icon: "fas fa-shopping-bag", label: "Commandes" },
        { to: "/profile", icon: "fas fa-user", label: "Compte" },
      ].map(({ to, icon, label }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-col items-center p-2 sm:p-3 text-gray-700 hover:text-green-600 transition-colors text-xs sm:text-sm"
          aria-label={label}
        >
          <i className={`${icon} text-base sm:text-lg`}></i>
          <span className="mt-1">{label}</span>
        </Link>
      ))}
    </div>
  </footer>
);

export default OrderTracking;