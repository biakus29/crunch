import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, setDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { FaStar } from "react-icons/fa";
import PropTypes from "prop-types";
import { formatPrice } from "./ordersstatuts";

const ThankYouPage = ({ order }) => {
  const { orderId: paramOrderId } = useParams();
  const effectiveOrderId = order?.id || paramOrderId;
  const [feedback, setFeedback] = useState({
    recommend: null,
    deliveryService: 0,
    foodQuality: 0,
    pointsExperience: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [orderName, setOrderName] = useState("votre commande");
  const [restaurantName, setRestaurantName] = useState("le restaurant");
  const [deliveryPersonName, setDeliveryPersonName] = useState("votre livreur");
  const [pointsUsed, setPointsUsed] = useState(0);
  const [pointsReduction, setPointsReduction] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

  useEffect(() => {
    if (!effectiveOrderId) {
      setError("ID de commande manquant.");
      return;
    }

    const fetchOrderDetails = async () => {
      try {
        if (order) {
          // Utiliser les données de la prop order si disponibles
          const items = Array.isArray(order.items) ? order.items : [];
          const firstItemName = items.length > 0 ? items[0].dishName || "Commande" : "Commande";
          setOrderName(`${firstItemName}${items.length > 1 ? " et plus" : ""}`);
          setRestaurantName(order.restaurantName || "le restaurant");
          setDeliveryPersonName(order.deliveryPersonName || "votre livreur");
          setPointsUsed(order.pointsUsed || 0);
          setPointsReduction(order.pointsReduction || 0);
          setLoyaltyPoints(order.loyaltyPoints || 0);
        } else {
          // Sinon, récupérer depuis Firestore
          const orderRef = doc(db, "orders", effectiveOrderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            const items = Array.isArray(orderData.items) ? orderData.items : [];
            const firstItemName = items.length > 0 ? items[0].dishName || "Commande" : "Commande";
            setOrderName(`${firstItemName}${items.length > 1 ? " et plus" : ""}`);
            setRestaurantName(orderData.restaurantName || "le restaurant");
            setDeliveryPersonName(orderData.deliveryPersonName || "votre livreur");
            setPointsUsed(orderData.pointsUsed || 0);
            setPointsReduction(orderData.pointsReduction || 0);
            setLoyaltyPoints(orderData.loyaltyPoints || 0);
          } else {
            setError("Commande non trouvée.");
          }
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des détails:", err);
        setError("Erreur lors du chargement des détails de la commande.");
      }
    };

    fetchOrderDetails();
  }, [effectiveOrderId, order]);

  const handleRatingChange = useCallback((category, value) => {
    setFeedback((prev) => ({ ...prev, [category]: value }));
  }, []);

  const handleRecommendationChange = useCallback((value) => {
    setFeedback((prev) => ({ ...prev, recommend: value }));
  }, []);

  const handlePointsExperienceChange = useCallback((e) => {
    setFeedback((prev) => ({ ...prev, pointsExperience: e.target.value }));
  }, []);

const handleSubmitFeedback = async (e) => {
  e.preventDefault();
  setError(null);
  if (!effectiveOrderId) {
    setError("ID de commande manquant.");
    return;
  }
  if (feedback.recommend === null || feedback.deliveryService === 0 || feedback.foodQuality === 0) {
    setError("Veuillez compléter toutes les évaluations.");
    return;
  }
  try {
    // Récupérer restaurantId
    let restaurantId = null;
    if (order) {
      restaurantId = order.restaurantId;
    } else {
      const orderRef = doc(db, "orders", effectiveOrderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        restaurantId = orderSnap.data().restaurantId;
      } else {
        throw new Error("Commande non trouvée.");
      }
    }

    if (!restaurantId) {
      throw new Error("ID du restaurant manquant.");
    }

    const feedbackRef = doc(collection(db, "feedback"));
    await setDoc(feedbackRef, {
      orderId: effectiveOrderId,
      userId: localStorage.getItem("guestUid") || null,
      restaurantId, // Ajout du restaurantId
      ...feedback,
      timestamp: Timestamp.now(),
    });

    if (window.fbq) {
      window.fbq("track", "CompleteRegistration", {
        content_name: "Feedback Submission",
        order_id: effectiveOrderId,
        value: feedback.recommend ? 1 : 0,
        currency: "XAF",
      });
    }

    setSubmitted(true);
  } catch (error) {
    console.error("Erreur lors de l’envoi du feedback:", error);
    setError("Erreur lors de l’envoi du feedback. Veuillez réessayer.");
  }
};

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Merci pour votre avis !</h2>
          <p className="text-gray-600 mb-6">Bon appétit !</p>
          <Link
            to="/complete_order"
            className="text-gray-600 hover:text-gray-800 underline"
            aria-label="Retour aux commandes"
          >
            Retour aux commandes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-between p-4">
      <div className="w-full max-w-md flex-1 flex flex-col justify-start">
        <div className="flex justify-between items-center mb-8">
          <Link to="/accueil" className="text-gray-600 text-lg" aria-label="Retour à l'accueil"></Link>
          <h2 className="text-sm text-gray-500">Noter votre livraison</h2>
          <Link to="/accueil" className="text-gray-600 text-sm" aria-label="Retour à l'accueil"></Link>
        </div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Merci pour votre confiance !
          </h2>
          <p className="text-xl font-medium text-green-600">
            Bon appétit à vous !
          </p>
        </div>
        {(pointsUsed > 0 || loyaltyPoints > 0) && (
          <div className="mb-8 text-center bg-gray-100 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Points de fidélité
            </h3>
            {pointsUsed > 0 && (
              <p className="text-sm text-gray-600">
                Vous avez utilisé {formatPrice(pointsUsed)} points pour une réduction de {formatPrice(pointsReduction)} FCFA.
              </p>
            )}
            {loyaltyPoints > 0 && (
              <p className="text-sm text-gray-600">
                Vous avez gagné {formatPrice(loyaltyPoints)} points pour cette commande (crédités après validation).
              </p>
            )}
          </div>
        )}
        <div className="w-full border-t border-gray-300 mb-8"></div>
        <div className="mb-12 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Recommanderiez-vous notre service ?
          </h3>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => handleRecommendationChange(true)}
              className={`px-6 py-2 rounded-full border-2 font-semibold text-lg transition-colors ${
                feedback.recommend === true
                  ? "border-green-500 text-green-500"
                  : "border-gray-300 text-gray-500 hover:border-gray-400"
              }`}
              aria-label="Recommander le service"
            >
              Oui
            </button>
            <button
              type="button"
              onClick={() => handleRecommendationChange(false)}
              className={`px-6 py-2 rounded-full border-2 font-semibold text-lg transition-colors ${
                feedback.recommend === false
                  ? "border-red-500 text-red-500"
                  : "border-gray-300 text-gray-500 hover:border-gray-400"
              }`}
              aria-label="Ne pas recommander le service"
            >
              Non
            </button>
          </div>
        </div>
        <div className="mb-12 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Comment était votre livraison avec {deliveryPersonName} ?
          </h3>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <FaStar
                key={value}
                size={40}
                className={`cursor-pointer transition-colors ${
                  value <= feedback.deliveryService ? "text-yellow-400" : "text-gray-300"
                }`}
                onClick={() => handleRatingChange("deliveryService", value)}
                aria-label={`Noter la livraison ${value} étoile${value > 1 ? "s" : ""}`}
              />
            ))}
          </div>
        </div>
        <div className="mb-12 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Noter le système de commande ?
          </h3>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <FaStar
                key={value}
                size={40}
                className={`cursor-pointer transition-colors ${
                  value <= feedback.foodQuality ? "text-yellow-400" : "text-gray-300"
                }`}
                onClick={() => handleRatingChange("foodQuality", value)}
                aria-label={`Noter la qualité des plats ${value} étoile${value > 1 ? "s" : ""}`}
              />
            ))}
          </div>
        </div>
        {(pointsUsed > 0 || loyaltyPoints > 0) && (
          <div className="mb-12 text-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Comment était votre expérience avec les points de fidélité ?
            </h3>
            <textarea
              value={feedback.pointsExperience}
              onChange={handlePointsExperienceChange}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Partagez vos commentaires sur l'utilisation des points (facultatif)"
              rows="4"
              aria-label="Commentaires sur les points de fidélité"
            />
          </div>
        )}
        {error && (
          <p className="text-red-600 text-center mb-4" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        onClick={handleSubmitFeedback}
        className="w-full max-w-md py-4 bg-red-500 text-white text-lg font-semibold rounded-full hover:bg-red-600 transition duration-300"
        aria-label="Soumettre le feedback"
      >
        Soumettre
      </button>
    </div>
  );
};

ThankYouPage.propTypes = {
  order: PropTypes.object,
};

export default ThankYouPage;