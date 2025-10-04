
import React, { useState, useEffect } from "react";
import { FaStar, FaCheckCircle } from "react-icons/fa";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Timestamp } from "firebase/firestore";
import { formatPrice } from "./ordersstatuts";
import { Link } from "react-router-dom";

const OrderRating = ({ order }) => {
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

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const orderRef = doc(db, "orders", order.id);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          const items = Array.isArray(orderData.items) ? orderData.items : [];
          const firstItemName = items.length > 0 ? items[0].dishName || "Commande" : "Commande";
          setOrderName(`${firstItemName}${items.length > 1 ? " et plus" : ""}`);
          setRestaurantName(orderData.restaurantName || "le restaurant");
          setDeliveryPersonName(orderData.deliveryPersonName || "votre livreur");
        } else {
          setError("Commande non trouvée.");
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des détails:", err);
        setError("Erreur lors du chargement des détails de la commande.");
      }
    };

    fetchOrderDetails();
  }, [order.id]);

  const handleRatingChange = (category, value) => {
    setFeedback((prev) => ({ ...prev, [category]: value }));
  };

  const handleRecommendationChange = (value) => {
    setFeedback((prev) => ({ ...prev, recommend: value }));
  };

  const handlePointsExperienceChange = (e) => {
    setFeedback((prev) => ({ ...prev, pointsExperience: e.target.value }));
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setError(null);
    if (feedback.recommend === null || feedback.deliveryService === 0 || feedback.foodQuality === 0) {
      setError("Veuillez compléter toutes les évaluations.");
      return;
    }
    try {
      const feedbackRef = doc(collection(db, "feedback"));
      await setDoc(feedbackRef, {
        orderId: order.id,
        userId: order.userId || null,
        ...feedback,
        timestamp: Timestamp.now(),
      });

      if (window.fbq) {
        window.fbq("track", "CompleteRegistration", {
          content_name: "Feedback Submission",
          order_id: order.id,
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
      <div className="bg-green-50 border-green-200 rounded-lg p-6 text-center">
        <FaCheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-green-700 mb-2">Merci pour votre avis !</h3>
        <p className="text-green-600 mb-4">Bon appétit !</p>
        <Link
          to="/complete_order"
          className="text-gray-600 hover:text-gray-800 underline"
          aria-label="Retour aux commandes"
        >
          Retour aux commandes
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <FaStar className="w-5 h-5 text-yellow-500" />
        Évaluez votre expérience
      </h3>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <div className="space-y-6">
        <div className="text-center">
          <h4 className="text-md font-semibold text-gray-800 mb-2">
            Recommanderiez-vous notre service ?
          </h4>
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
        <div className="text-center">
          <h4 className="text-md font-semibold text-gray-800 mb-2">
            Comment était votre livraison avec {deliveryPersonName} ?
          </h4>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <FaStar
                key={value}
                size={24}
                className={`cursor-pointer transition-colors ${
                  value <= feedback.deliveryService ? "text-yellow-400" : "text-gray-300"
                }`}
                onClick={() => handleRatingChange("deliveryService", value)}
                aria-label={`Noter la livraison ${value} étoile${value > 1 ? "s" : ""}`}
              />
            ))}
          </div>
        </div>
        <div className="text-center">
          <h4 className="text-md font-semibold text-gray-800 mb-2">
            Comment était le système de commande ?
          </h4>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <FaStar
                key={value}
                size={24}
                className={`cursor-pointer transition-colors ${
                  value <= feedback.foodQuality ? "text-yellow-400" : "text-gray-300"
                }`}
                onClick={() => handleRatingChange("foodQuality", value)}
                aria-label={`Noter la qualité des plats ${value} étoile${value > 1 ? "s" : ""}`}
              />
            ))}
          </div>
        </div>
        {(order.pointsUsed > 0 || order.loyaltyPoints > 0) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <i className="fas fa-comment text-gray-500"></i>
              Commentaire sur les points de fidélité (optionnel)
            </label>
            <textarea
              value={feedback.pointsExperience}
              onChange={handlePointsExperienceChange}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[80px]"
              placeholder="Partagez vos commentaires sur l'utilisation des points..."
              aria-label="Commentaires sur les points de fidélité"
            />
          </div>
        )}
        <button
          onClick={handleSubmitFeedback}
          className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:bg-gray-300"
          disabled={feedback.recommend === null || feedback.deliveryService === 0 || feedback.foodQuality === 0}
          aria-label="Soumettre l'évaluation"
        >
          Confirmer l'évaluation
        </button>
      </div>
    </div>
  );
};

export default OrderRating;
