import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Calendar, TrendingUp, DollarSign, Smartphone, CreditCard } from "lucide-react";
import { db } from "../firebase";
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';

// --- Utilitaires ---
const convertPrice = (price) => {
  if (price == null) return 0;
  const str = typeof price === "string" ? price.replace(/[^\d]/g, "") : price;
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const formatPrice = (value) =>
  Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const getLocalDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const parseLocalDateKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const formatLocalDate = (date, options = { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) => {
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', options);
};

// Obtenir la date principale d'une commande (livraison ou emporter)
const getOrderDate = (order) => {
  const candidates = [order?.timestamp, order?.createdAt, order?.updatedAt];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c?.toDate === 'function') {
      const d = c.toDate();
      if (!isNaN(d)) return d;
    }
    const d = new Date(c);
    if (!isNaN(d)) return d;
  }
  return null;
};

// Déduire la méthode de paiement depuis différents schémas
const derivePaymentMethod = (order) => {
  // 1) paymentMethod direct si présent
  if (order && typeof order.paymentMethod === 'string') return order.paymentMethod;

  // 2) payment imbriqué (pour 'takeaway')
  const pm = order?.payment;
  if (!pm) return '';
  const method = String(pm.method || '').toLowerCase();
  if (method === 'cash') return 'cash';
  if (method === 'mobile_money') {
    const provider = String(pm.provider || '').toLowerCase();
    if (provider === 'om' || provider.includes('orange')) return 'orange';
    if (provider === 'momo' || provider.includes('mtn')) return 'mtn';
    return 'mobile_money';
  }
  if (method === 'bank_transfer') return 'cash'; // regrouper avec cash
  return method;
};

// Calculer le sous-total des articles d'une commande quand nécessaire
const computeItemsSubtotal = (order) => {
  if (!order?.items || !Array.isArray(order.items)) return 0;
  return order.items.reduce((sum, it) => {
    const qty = Number(it?.quantity || 1);
    // Base price: préférer it.price, sinon it.dishPrice, sinon 0
    const base = convertPrice(it?.price ?? it?.dishPrice ?? 0);
    // Extras: utiliser it.extras si présent (avec prix), sinon 0
    const extras = Array.isArray(it?.extras)
      ? it.extras.reduce((eSum, ex) => eSum + convertPrice(ex?.price || 0), 0)
      : 0;
    return sum + (base + extras) * qty;
  }, 0);
};

const DELIVERED_STATUSES = ["livree", "delivered"];

export default function SalesHistory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [dateRange, setDateRange] = useState("30");
  const [sortMode, setSortMode] = useState("date");

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Calculer la date de début selon la plage sélectionnée
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(dateRange));

      // 1) Commandes livrées (livraison)
      const deliveredQuery = query(
        collection(db, 'orders'),
        where('status', 'in', DELIVERED_STATUSES),
        orderBy('timestamp', 'desc')
      );
      const deliveredSnap = await getDocs(deliveredQuery);
      const deliveredData = deliveredSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // 2) Commandes à emporter (type: 'takeaway')
      const takeawayQuery = query(
        collection(db, 'orders'),
        where('type', '==', 'takeaway'),
        orderBy('createdAt', 'desc')
      );
      const takeawaySnap = await getDocs(takeawayQuery);
      const takeawayData = takeawaySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Fusion + filtre par période en se basant sur la date normalisée
      const merged = [...deliveredData, ...takeawayData].filter((order) => {
        const od = getOrderDate(order);
        return od && od >= startDate && od <= endDate;
      });

      setOrders(merged);
    } catch (err) {
      console.error('Erreur lors du chargement des commandes:', err);
      setError('Impossible de charger l\'historique des ventes');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // --- Calcul des ventes journalières ---
  const dailySalesData = useMemo(() => {
    const salesByDay = {};

    orders.forEach(order => {
      const orderDate = getOrderDate(order);
      if (!orderDate) return;

      const dateKey = getLocalDateKey(orderDate); // Clé locale YYYY-MM-DD
      if (!salesByDay[dateKey]) {
        salesByDay[dateKey] = {
          date: dateKey,
          totalCash: 0,
          totalOM: 0,
          totalMOMO: 0,
          totalDaily: 0,
          ordersCount: 0,
        };
      }

      const storedTotal = convertPrice(order.total);
      const deliveryFee = convertPrice(order.deliveryFee);
      const pointsReduction = convertPrice(order.pointsReduction);
      const itemsSubtotal = computeItemsSubtotal(order);

      // Déterminer le total à utiliser
      // - Si un total stocké semble valide (>= items et >= frais), on l'utilise
      // - Sinon on reconstruit: items + livraison
      let computedTotal = itemsSubtotal + deliveryFee;
      const hasValidStoredTotal = storedTotal > 0 && storedTotal >= deliveryFee && storedTotal >= itemsSubtotal;
      const totalBeforeReduction = hasValidStoredTotal ? storedTotal : computedTotal;
      const finalTotal = Math.max(0, totalBeforeReduction - pointsReduction);

      // Normaliser le mode de paiement (supporte aussi 'payment.method'/'payment.provider')
      const method = String(derivePaymentMethod(order) ?? '').toLowerCase();

      if (method.includes("cash") || method.includes("espece") || method.includes("espèce")) {
        salesByDay[dateKey].totalCash += finalTotal;
      } else if (method.includes("orange") || method.includes("om")) {
        salesByDay[dateKey].totalOM += finalTotal;
      } else if (method.includes("mtn") || method.includes("momo")) {
        salesByDay[dateKey].totalMOMO += finalTotal;
      } else if (order.isPaid) {
        salesByDay[dateKey].totalOM += finalTotal / 2;
        salesByDay[dateKey].totalMOMO += finalTotal / 2;
      }

      salesByDay[dateKey].totalDaily += finalTotal;
      salesByDay[dateKey].ordersCount++;
    });

    const arr = Object.values(salesByDay);

    if (sortMode === "weekday") {
      const weekdayRank = (key) => {
        const day = parseLocalDateKey(key).getDay();
        return day === 0 ? 7 : day; // Dimanche après Samedi
      };
      arr.sort((a, b) => weekdayRank(a.date) - weekdayRank(b.date));
    } else {
      arr.sort((a, b) => parseLocalDateKey(b.date) - parseLocalDateKey(a.date));
    }

    return arr;
  }, [orders, sortMode]);

  const totals = useMemo(
    () =>
      dailySalesData.reduce(
        (acc, day) => ({
          totalCash: acc.totalCash + day.totalCash,
          totalOM: acc.totalOM + day.totalOM,
          totalMOMO: acc.totalMOMO + day.totalMOMO,
          totalDaily: acc.totalDaily + day.totalDaily,
          ordersCount: acc.ordersCount + day.ordersCount,
        }),
        { totalCash: 0, totalOM: 0, totalMOMO: 0, totalDaily: 0, ordersCount: 0 }
      ),
    [dailySalesData]
  );

  // --- UI ---
  if (loading)
    return (
      <div className="bg-white rounded-xl shadow p-6 flex items-center justify-center space-x-3">
        <div className="animate-spin h-6 w-6 border-2 border-green-600 border-t-transparent rounded-full"></div>
        <span className="text-gray-600">Chargement...</span>
      </div>
    );

  if (error)
    return (
      <div className="bg-white rounded-xl shadow p-6 text-center text-red-600">
        {error}
        <button
          onClick={loadOrders}
          className="block mt-3 mx-auto text-sm text-blue-600 hover:underline"
        >
          Réessayer
        </button>
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg p-6"
    >
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold text-gray-900">Historique des ventes</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-green-500"
          >
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
            <option value="365">1 an</option>
          </select>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="border rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-green-500"
          >
            <option value="date">Par date</option>
            <option value="weekday">Par jour (Lun → Dim)</option>
          </select>
        </div>
      </div>

      {/* Résumé Totaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Cash", color: "blue", value: totals.totalCash, icon: DollarSign },
          { label: "Orange Money", color: "orange", value: totals.totalOM, icon: Smartphone },
          { label: "MTN MOMO", color: "yellow", value: totals.totalMOMO, icon: CreditCard },
          { label: "Total", color: "green", value: totals.totalDaily, icon: TrendingUp },
        ].map(({ label, color, value, icon: Icon }) => (
          <div key={label} className={`bg-${color}-50 p-4 rounded-lg`}>
            <div className="flex items-center">
              <Icon className={`w-5 h-5 text-${color}-600 mr-2`} />
              <span className={`text-sm font-medium text-${color}-800`}>{label}</span>
            </div>
            <p className={`text-lg font-bold text-${color}-900 mt-1`}>
              {formatPrice(value)} FCFA
            </p>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-right py-3 px-4">Cash</th>
              <th className="text-right py-3 px-4">OM</th>
              <th className="text-right py-3 px-4">MOMO</th>
              <th className="text-right py-3 px-4">Total</th>
              <th className="text-center py-3 px-4">Cmd</th>
            </tr>
          </thead>
          <tbody>
            {dailySalesData.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-6 text-gray-500">
                  Aucune vente sur cette période.
                </td>
              </tr>
            ) : (
              dailySalesData.map((day, i) => (
                <motion.tr
                  key={day.date}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="py-3 px-4">{formatLocalDate(parseLocalDateKey(day.date))}</td>
                  <td className="py-3 px-4 text-right text-blue-600">
                    {formatPrice(day.totalCash)} FCFA
                  </td>
                  <td className="py-3 px-4 text-right text-orange-600">
                    {formatPrice(day.totalOM)} FCFA
                  </td>
                  <td className="py-3 px-4 text-right text-yellow-600">
                    {formatPrice(day.totalMOMO)} FCFA
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-green-600">
                    {formatPrice(day.totalDaily)} FCFA
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2.5 py-0.5 bg-gray-100 rounded-full text-xs font-medium">
                      {day.ordersCount}
                    </span>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
