import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { normalizePhone } from "../utils/phoneutils";

const TrackRedirect = () => {
  const { numeroTelephoneClient, phone } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const go = async () => {
      try {
        const rawPhone = phone ?? numeroTelephoneClient;
        if (!rawPhone) {
          setError("Numéro manquant");
          return;
        }

        const decodedPhone = decodeURIComponent(rawPhone);

        const variations = normalizePhone(decodedPhone);
        const phonesToTry = variations.length ? variations : [decodedPhone];

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
            // Prefer unpaid/pending if applicable (fallback to last anyway)
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

        const url = `/complete_order/${targetOrderId}`;

        navigate(url, { replace: true });
      } catch (e) {
        console.error("❌ TrackRedirect error:", e);
        setError(e.message || "Redirection impossible");
      }
    };
    go();
  }, [numeroTelephoneClient, phone, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center text-gray-600">
        {error ? (
          <>
            <p className="text-red-600 font-medium mb-2">{error}</p>
            <p className="text-sm">Vérifiez le numéro saisi puis réessayez.</p>
          </>
        ) : (
          <p>Redirection vers le suivi de commande…</p>
        )}
      </div>
    </div>
  );
};

export default TrackRedirect;
