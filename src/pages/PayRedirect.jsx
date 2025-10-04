import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { normalizePhone } from "../utils/phoneutils";

const PayRedirect = () => {
  const { numeroTelephoneClient } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const go = async () => {
      try {
        if (!numeroTelephoneClient) {
          setError("Numéro manquant");
          return;
        }
        // Normalize provided number and search for the latest pending/unpaid order
        const variations = normalizePhone(numeroTelephoneClient);
        const phonesToTry = variations.length ? variations : [numeroTelephoneClient];

        let targetOrderId = null;
        for (const phone of phonesToTry) {
          // Try orders by contact.phone
          const q1 = query(
            collection(db, "orders"),
            where("contact.phone", "==", phone),
            orderBy("timestamp", "desc"),
            limit(1)
          );
          const snap1 = await getDocs(q1);
          if (!snap1.empty) {
            const data = snap1.docs[0].data();
            targetOrderId = snap1.docs[0].id;
            // Prefer unpaid / pending, otherwise still redirect to last
            if (data && (data.isPaid === false || data.status === "en_attente")) break;
          }
          // Fallback: legacy address.phone
          const q2 = query(
            collection(db, "orders"),
            where("address.phone", "==", phone),
            orderBy("timestamp", "desc"),
            limit(1)
          );
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            const data = snap2.docs[0].data();
            targetOrderId = snap2.docs[0].id;
            if (data && (data.isPaid === false || data.status === "en_attente")) break;
          }
        }

        if (!targetOrderId) {
          setError("Aucune commande trouvée pour ce numéro.");
          return;
        }
        navigate(`/complete_order/${targetOrderId}`, { replace: true });
      } catch (e) {
        setError(e.message || "Redirection impossible");
      }
    };
    go();
  }, [numeroTelephoneClient, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center text-gray-600">
        {error ? (
          <>
            <p className="text-red-600 font-medium mb-2">{error}</p>
            <p className="text-sm">Vérifiez le numéro saisi puis réessayez.</p>
          </>
        ) : (
          <p>Redirection vers la page de paiement…</p>
        )}
      </div>
    </div>
  );
};

export default PayRedirect;
