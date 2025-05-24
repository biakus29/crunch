import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, getDocs, updateDoc,where,Timestamp,query,collection } from "firebase/firestore";
import { db } from "../firebase";

// Configuration de l'API Flashup
const AUTH_BASE_URL = "https://auth.seed-apps.com";
const REALM = "flashpay";
const CLIENT_ID = "api-000003-cc";
const CLIENT_SECRET = "AC1HRSNpPp0Wd6SVk4rClJna8nrmtpr2";
const BASE_API_URL = "https://flashup.seed-apps.com/";

const PaymentFailure = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Fonction pour obtenir le jeton API Flashup
  const getApiToken = async () => {
    try {
      const authParams = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      });

      const response = await fetch(`${AUTH_BASE_URL}/realms/${REALM}/protocol/openid-connect/token`, {
        method: "POST",
        body: authParams.toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (!response.ok) {
        throw new Error("Échec de l'obtention du jeton API");
      }

      const data = await response.json();
      return data.access_token;
    } catch (err) {
      console.error("Erreur lors de la récupération du jeton API :", err);
      setError("Impossible de s'authentifier avec le service de paiement.");
      return null;
    }
  };

  // Fonction pour vérifier le statut de la transaction
  const getTransactionStatus = async (token, transactionCode) => {
    try {
      const response = await fetch(`${BASE_API_URL}/rest/api/v1/payments/${transactionCode}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "*/*",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Échec de la récupération du statut de la transaction");
      }

      return await response.json();
    } catch (err) {
      console.error("Erreur lors de la récupération du statut de la transaction :", err);
      throw err;
    }
  };

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        // Récupérer le transactionCode depuis les paramètres de l'URL
        const params = new URLSearchParams(location.search);
        const transactionCode = params.get("code"); // Supposons que Flashup renvoie ?code=PC21...
        if (!transactionCode) {
          setError("Code de transaction manquant.");
          setLoading(false);
          return;
        }

        // Récupérer orderId depuis Firestore en recherchant la commande avec ce transactionCode
        const orderQuery = query(
          collection(db, "orders"),
          where("paymentDetails.transactionCode", "==", transactionCode)
        );
        const orderSnapshot = await getDocs(orderQuery);
        if (orderSnapshot.empty) {
          setError("Commande non trouvée pour ce paiement.");
          setLoading(false);
          return;
        }

        const orderDoc = orderSnapshot.docs[0];
        const orderId = orderDoc.id;

        // Obtenir le jeton API
        const token = await getApiToken();
        if (!token) {
          setLoading(false);
          return;
        }

        // Vérifier le statut de la transaction
        const transactionData = await getTransactionStatus(token, transactionCode);
        setStatus(transactionData.status);

        // Mettre à jour la commande dans Firestore
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
          isPaid: false,
          paymentStatus: transactionData.status,
          updatedAt: Timestamp.now(),
        });

        // Afficher un message d'erreur basé sur le statut
        setError(`Le paiement a échoué. Statut : ${transactionData.status}`);
      } catch (err) {
        console.error("Erreur lors de la vérification du paiement :", err);
        setError("Une erreur s'est produite lors de la vérification du paiement. Veuillez réessayer.");
      } finally {
        setLoading(false);
      }
    };

    checkPaymentStatus();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-md text-center max-w-md w-full">
        {loading && (
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin h-8 w-8 text-green-600 mr-3"
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
            <span>Vérification du paiement...</span>
          </div>
        )}
        {!loading && (
          <div>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => navigate("/cart")}
              className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              Retourner au panier
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentFailure;