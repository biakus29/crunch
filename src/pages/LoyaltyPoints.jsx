import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  getDoc,
} from "firebase/firestore";

const LOYALTY_THRESHOLD = 5000;
const FIRST_RATE = 0.1;
const NORMAL_RATE = 0.05;
const CREDIT_PER_POINT = 100;
// Date d’intégration du système de points
const INTEGRATION_DATE = new Date("2025-01-01T00:00:00Z");

const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const LoyaltyPointsManager = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        // Récupère toutes les commandes >= seuil
        const ordersQuery = query(
          collection(db, "orders"),
          where("total", ">=", LOYALTY_THRESHOLD)
        );
        const snapshot = await getDocs(ordersQuery);

        // Map + filtre post-intégration + tri par timestamp décroissant
        const fetchedOrders = await Promise.all(
          snapshot.docs.map(async (d) => {
            const data = d.data();
            const order = {
              id: d.id,
              ...data,
              date: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
            };

            // Récupérer les informations de l'utilisateur
            let clientName = "Utilisateur inconnu";
            if (order.userId) {
              const userRef = doc(db, "usersrestau", order.userId);
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                const userData = userDoc.data();
                clientName =
                  `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
                  userData.email ||
                  "Utilisateur inconnu";
              }
            } else if (order.contact?.name) {
              clientName = order.contact.name;
            }

            // Calculer les points à créditer
            const pointsToCredit = await calculatePoints(order);

            return {
              ...order,
              clientName,
              pointsToCredit,
            };
          })
        );

        // Filtrer et trier
        const filteredOrders = fetchedOrders
          .filter((o) => o.date >= INTEGRATION_DATE)
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        setOrders(filteredOrders);
      } catch (err) {
        console.error("Erreur de récupération des commandes :", err);
        setError("Impossible de charger les commandes.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const calculatePoints = async (order) => {
    // Vérifie si l’utilisateur a déjà des points_grant approuvés
    const txQuery = query(
      collection(db, "pointsTransactions"),
      where("orderId", "==", order.id),
      where("type", "==", "points_grant"),
      where("status", "==", "approved")
    );
    const txSnap = await getDocs(txQuery);
    const isFirst = txSnap.empty;

    const deliveryFee = Number(order.deliveryFee) || 1000;
    const baseTotal = Number(order.total) - deliveryFee;
    const rate = isFirst ? FIRST_RATE : NORMAL_RATE;
    return Math.floor((baseTotal * rate) / CREDIT_PER_POINT);
  };

  const creditPoints = async (order) => {
    try {
      setLoading(true);
      const pts = order.pointsToCredit; // Utiliser les points déjà calculés
      if (pts <= 0) {
        setError(`Pas de points à créditer pour #${order.id.slice(0, 8)}.`);
        return;
      }
      const userRef = doc(db, "usersrestau", order.userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        setError(`Utilisateur ${order.userId} introuvable.`);
        return;
      }

      // Cherche transaction pending
      const pendingQ = query(
        collection(db, "pointsTransactions"),
        where("orderId", "==", order.id),
        where("type", "==", "points_grant"),
        where("status", "==", "pending")
      );
      const pendingSnap = await getDocs(pendingQ);
      if (!pendingSnap.empty) {
        // Approuve l’existante
        const txDoc = pendingSnap.docs[0];
        await updateDoc(doc(db, "pointsTransactions", txDoc.id), {
          status: "approved",
          timestamp: new Date(),
        });
      } else {
        // Crée une nouvelle transaction approuvée
        await addDoc(collection(db, "pointsTransactions"), {
          userId: order.userId,
          orderId: order.id,
          pointsAmount: pts,
          type: "points_grant",
          status: "approved",
          message: `Crédit ${pts} pts pour #${order.id.slice(0, 8)}`,
          timestamp: new Date(),
          read: false,
        });
      }

      // Met à jour le solde de l’utilisateur
      const current = userDoc.data().points || 0;
      await updateDoc(userRef, { points: current + pts, updatedAt: new Date() });

      setSuccessMessage(`${pts} pts ajoutés pour #${order.id.slice(0, 8)}.`);
      // Retire la commande de la liste
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Erreur creditPoints :", err);
      setError("Échec du crédit de points.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts) => {
    // ts peut être un Timestamp Firestore, un objet Date, une string ou undefined
    let d;
    if (!ts) {
      d = new Date(); // fallback
    } else if (typeof ts.toDate === "function") {
      d = ts.toDate();
    } else if (ts instanceof Date) {
      d = ts;
    } else {
      d = new Date(ts);
    }
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="p-6 bg-gray-100 rounded-lg min-h-[300px]">
      <h3 className="text-xl font-semibold mb-4">Gestion Points de Fidélité</h3>

      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
          <span className="ml-2">Chargement…</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
          <button onClick={() => window.location.reload()} className="underline ml-2">
            Réessayer
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{successMessage}</div>
      )}

      {!loading && !error && (
        orders.length > 0 ? (
          orders.map((order) => (
            <div
              key={order.id}
              className="bg-white p-4 rounded-lg flex justify-between items-center mb-4 shadow"
            >
              <div>
                <p className="font-semibold">#{order.id.slice(0, 8)}</p>
                <p className="text-sm text-gray-600">Client: {order.clientName}</p>
                <p className="text-sm text-gray-600">Total: {formatPrice(order.total)} FCFA</p>
                <p className="text-sm text-gray-600">Date: {formatDate(order.date)}</p>
                <p className="text-sm text-gray-600">Statut: {order.status}</p>
                <p className="text-sm text-gray-600">Payé: {order.isPaid ? "Oui" : "Non"}</p>
                <p className="text-sm text-gray-600">
                  Points à créditer: {order.pointsToCredit} pts
                </p>
              </div>
              <button
                onClick={() => creditPoints(order)}
                disabled={loading}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                <i className="fas fa-star mr-1"></i> Créditer
              </button>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500">
            Aucune commande ≥ {LOYALTY_THRESHOLD} FCFA après le 01/01/2025.
          </p>
        )
      )}
    </div>
  );
};

export default LoyaltyPointsManager;