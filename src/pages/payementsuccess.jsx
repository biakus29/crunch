import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/cartcontext";
import { db } from "../firebase";
import { doc, updateDoc, getDoc, Timestamp } from "firebase/firestore";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const updateOrder = async () => {
      try {
        // Récupérer les paramètres d'URL
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get("payment_status");
        const transactionId = urlParams.get("transaction_id");
        const orderId = urlParams.get("order_id");

        if (!paymentStatus || !transactionId || !orderId) {
          throw new Error("Paramètres de paiement manquants.");
        }

        // Récupérer les données de la commande en attente
        const pendingOrder = JSON.parse(localStorage.getItem("pendingOrder"));
        if (!pendingOrder || pendingOrder.orderId !== orderId || pendingOrder.transactionId !== transactionId) {
          throw new Error("Données de commande en attente non valides.");
        }

        // Vérifier le statut du paiement via l'API
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

        // Récupérer la commande depuis Firestore
        const orderRef = doc(db, "orders", orderId);
        const orderDoc = await getDoc(orderRef);
        if (!orderDoc.exists()) {
          throw new Error("Commande non trouvée dans la base de données.");
        }

        const orderData = orderDoc.data();

        // Mettre à jour la commande
        await updateDoc(orderRef, {
          status: finalStatus,
          isPaid: isPaymentSuccess,
          paymentRef: transactionId,
          timestamp: Timestamp.now(),
        });

        // Vider le panier et supprimer les données en attente
        clearCart();
        localStorage.removeItem("pendingOrder");

        // Définir le message de succès
        setSuccessMessage("Paiement réussi ! Votre commande a été confirmée.");

        // Rediriger après 3 secondes
        setTimeout(() => {
          navigate("/complete_order", {
            state: {
              orderId,
              isGuest: orderData.isGuest,
              paymentStatus: finalStatus,
              transactionId,
            },
            replace: true,
          });
        }, 3000);
      } catch (err) {
        console.error("Erreur lors de la mise à jour de la commande :", err);
        setError("Une erreur s'est produite lors du traitement de votre paiement. Veuillez contacter le support.");
        localStorage.removeItem("pendingOrder");
        navigate("/payment/failure", {
          state: { error: err.message },
          replace: true,
        });
      } finally {
        setLoading(false);
      }
    };

    updateOrder();
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
            <span>Mise à jour de la commande...</span>
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