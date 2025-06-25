import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/cartcontext";
import { auth, db } from "../firebase";
import { addDoc, collection, Timestamp } from "firebase/firestore";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const createOrder = async () => {
      try {
        // Récupérer tempOrderData depuis localStorage
        const tempOrderData = JSON.parse(localStorage.getItem("tempOrderData"));
        if (!tempOrderData) {
          throw new Error("Données de commande manquantes.");
        }

        const {
          userId,
          items,
          address,
          paymentMethod,
          total,
          deliveryFee,
          pointsUsed = 0,
          pointsReduction = 0,
          loyaltyPoints = 0,
          loyaltyEligible,
          isGuest,
          label,
          paymentRef,
        } = tempOrderData;

        // Vérification minimale des données essentielles
        if (!items?.length || !address?.area || !paymentMethod?.id || !total || !paymentRef) {
          throw new Error("Données de commande incomplètes.");
        }

        // Déterminer l'UID (au cas où userId est invalide)
        const uid = userId || auth.currentUser?.uid || localStorage.getItem("guestUid") || `guest_${Date.now()}`;

        // Créer la commande dans Firestore
        const orderRef = await addDoc(collection(db, "orders"), {
          userId: uid,
          items,
          address,
          paymentMethod,
          total: Number(total),
          deliveryFee: Number(deliveryFee),
          pointsUsed,
          pointsReduction,
          loyaltyPoints,
          loyaltyEligible,
          status: "confirmed", // Paiement réussi
          isPaid: true, // Paiement débité
          timestamp: Timestamp.now(),
          isGuest: !!isGuest,
          label,
          paymentRef, // Transaction ID
        });

        // Vider le panier et supprimer tempOrderData
        clearCart();
        localStorage.removeItem("tempOrderData");

        // Définir le message de succès
        setSuccessMessage("Paiement réussi ! Votre commande a été enregistrée.");

        // Rediriger après 3 secondes
        setTimeout(() => {
          navigate("/complete_order", {
            state: {
              orderId: orderRef.id,
              isGuest,
              paymentStatus: "confirmed",
              transactionId: paymentRef,
            },
            replace: true,
          });
        }, 3000);
      } catch (err) {
        console.error("Erreur lors de la création de la commande :", err);
        setError("Une erreur s'est produite lors de l'enregistrement de votre commande. Veuillez réessayer.");
      } finally {
        setLoading(false);
      }
    };

    createOrder();
  }, [clearCart, navigate]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-md text-center max-w-md w-full">
        {loading && (
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin h-8 w-8 text-green-600 mr-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-40"
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
            <span>Enregistrement de la commande...</span>
          </div>
        )}
        {!loading && error && (
          <div className="mb-4">
            <p className="text-red-500 mb-2">{error}</p>
            <button
              onClick={() => navigate("/cart")}
              className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Retourner au panier
            </button>
          </div>
        )}
        {!loading && !error && successMessage && (
          <div>
            <div className="flex items-center justify-center mb-4">
              <i className="fas fa-check-circle text-green-600 text-3xl mr-2"></i>
              <p className="text-green-600">{successMessage}</p>
            </div>
            <p className="text-gray-600">Redirection vers la confirmation...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;