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
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [itemsMap, setItemsMap] = useState(new Map()); // itemId -> { menuId, menuName }
  const [menusMap, setMenusMap] = useState(new Map()); // menuId -> menuName

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

  // Charger menus et items pour mapper item -> menu depuis la base
  useEffect(() => {
    (async () => {
      try {
        const [menusSnap, itemsSnap] = await Promise.all([
          getDocs(collection(db, 'menus')),
          getDocs(collection(db, 'items')),
        ]);

        const mMap = new Map();
        menusSnap.forEach((doc) => {
          const d = doc.data() || {};
          const name = d.name || d.title || d.label || doc.id;
          mMap.set(doc.id, String(name));
        });
        setMenusMap(mMap);

        const iMap = new Map();
        itemsSnap.forEach((doc) => {
          const d = doc.data() || {};
          const menuId = d.menuId || d.menu || null;
          const menuName = (menuId && mMap.get(menuId)) || d.menuName || d.categoryName || d.category || '';
          iMap.set(doc.id, { menuId, menuName: String(menuName || '') });
        });
        setItemsMap(iMap);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // --- Calcul des ventes journalières ---
  const dailySalesData = useMemo(() => {
    const salesByDay = {};
    const menuTotalsByDay = {}; // { dayKey: Map(menuName -> amount) }
    const overallMenuTotals = new Map();

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
          deliverySum: 0,
        };
        menuTotalsByDay[dateKey] = new Map();
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

      // Répartition des ventes par menus (hors frais de livraison)
      const saleAmount = Math.max(0, finalTotal - deliveryFee);
      const items = Array.isArray(order.items) ? order.items : [];
      const serviceMenus = Array.from(new Set(items.map(it => {
        const mapped = itemsMap.get(it?.dishId || it?.itemId);
        return mapped?.menuName || it?.menuName || it?.menu || it?.categoryName || it?.category;
      }).filter(Boolean)));
      const menusForSplit = serviceMenus.length ? serviceMenus : [];
      const perMenuShare = menusForSplit.length ? (saleAmount / menusForSplit.length) : 0;
      const dayMap = menuTotalsByDay[dateKey];
      menusForSplit.forEach((m) => {
        dayMap.set(m, (dayMap.get(m) || 0) + perMenuShare);
        overallMenuTotals.set(m, (overallMenuTotals.get(m) || 0) + perMenuShare);
      });
      // Cumuler les frais de livraison séparément
      if (deliveryFee > 0) {
        salesByDay[dateKey].deliverySum += deliveryFee;
      }

      // Paiement mixte: répartir précisément les montants
      const p = order?.payment || {};
      const pmMethod = String(p.method || '').toLowerCase();
      if (pmMethod === 'mixed') {
        const cashPart = convertPrice(p.cashAmount || 0);
        const mobilePart = convertPrice(p.mobileAmount || 0);
        const provider = String(p.provider || '').toLowerCase();
        // Ajouter les parts connues
        salesByDay[dateKey].totalCash += cashPart;
        if (provider === 'om' || provider.includes('orange')) {
          salesByDay[dateKey].totalOM += mobilePart;
        } else if (provider === 'momo' || provider.includes('mtn')) {
          salesByDay[dateKey].totalMOMO += mobilePart;
        } else {
          // Provider inconnu: répartir mobile 50/50
          salesByDay[dateKey].totalOM += mobilePart / 2;
          salesByDay[dateKey].totalMOMO += mobilePart / 2;
        }
      } else {
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

    // Top menus global (hors colonne Livraison dédiée)
    const topMenus = Array.from(overallMenuTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([n]) => n);

    // Attacher les totaux menus au résultat
    return arr.map((d) => ({ ...d, _menuTotals: menuTotalsByDay[d.date], _topMenus: topMenus }));
  }, [orders, sortMode, itemsMap]);

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

  // Totaux par méthode pour les cartes (sur la journée sélectionnée ou sur toute la période)
  const cardMethodTotals = useMemo(() => {
    const bucket = {
      cash: { total: 0, delivery: 0, service: 0 },
      om: { total: 0, delivery: 0, service: 0 },
      momo: { total: 0, delivery: 0, service: 0 },
    };

    const sourceOrders = selectedDayKey
      ? orders.filter((o) => {
          const d = getOrderDate(o);
          return d && getLocalDateKey(d) === selectedDayKey;
        })
      : orders;

    sourceOrders.forEach((order) => {
      const storedTotal = convertPrice(order.total);
      const deliveryFee = convertPrice(order.deliveryFee);
      const pointsReduction = convertPrice(order.pointsReduction);
      const itemsSubtotal = computeItemsSubtotal(order);
      const hasValidStoredTotal = storedTotal > 0 && storedTotal >= deliveryFee && storedTotal >= itemsSubtotal;
      const totalBeforeReduction = hasValidStoredTotal ? storedTotal : (itemsSubtotal + deliveryFee);
      const finalTotal = Math.max(0, totalBeforeReduction - pointsReduction);

      let amounts = { cash: 0, om: 0, momo: 0 };
      const p = order?.payment || {};
      const pmMethod = String(p.method || '').toLowerCase();
      if (pmMethod === 'mixed') {
        const cashPart = convertPrice(p.cashAmount || 0);
        const mobilePart = convertPrice(p.mobileAmount || 0);
        const provider = String(p.provider || '').toLowerCase();
        amounts.cash += cashPart;
        if (provider === 'om' || provider.includes('orange')) amounts.om += mobilePart;
        else if (provider === 'momo' || provider.includes('mtn')) amounts.momo += mobilePart;
        else { amounts.om += mobilePart / 2; amounts.momo += mobilePart / 2; }
      } else {
        const method = String(derivePaymentMethod(order) ?? '').toLowerCase();
        if (method.includes('cash') || method.includes('espece') || method.includes('espèce')) amounts.cash += finalTotal;
        else if (method.includes('orange') || method.includes('om')) amounts.om += finalTotal;
        else if (method.includes('mtn') || method.includes('momo')) amounts.momo += finalTotal;
        else if (order.isPaid) { amounts.om += finalTotal / 2; amounts.momo += finalTotal / 2; }
      }

      const deliveryRatio = finalTotal > 0 ? (deliveryFee / finalTotal) : 0;
      const serviceRatio = Math.max(0, 1 - deliveryRatio);
      (['cash','om','momo']).forEach((k) => {
        const amount = amounts[k];
        if (amount <= 0) return;
        bucket[k].total += amount;
        bucket[k].delivery += amount * deliveryRatio;
        bucket[k].service += amount * serviceRatio;
      });
    });

    return bucket;
  }, [orders, selectedDayKey]);

  // Décomposition par moyen de paiement pour la journée sélectionnée
  const paymentMethodBreakdown = useMemo(() => {
    const bucket = {
      cash: { total: 0, delivery: 0, service: 0, perService: new Map() },
      om: { total: 0, delivery: 0, service: 0, perService: new Map() },
      momo: { total: 0, delivery: 0, service: 0, perService: new Map() },
    };

    const getServices = (order) => {
      const items = Array.isArray(order?.items) ? order.items : [];
      const names = new Set();
      for (const it of items) {
        const mapped = itemsMap.get(it?.dishId || it?.itemId);
        const name = mapped?.menuName || it?.menuName || it?.menu || it?.categoryName || it?.category;
        if (name) names.add(String(name));
      }
      return Array.from(names);
    };

    const dayOrders = orders.filter((o) => {
      const d = getOrderDate(o);
      if (!d) return false;
      return getLocalDateKey(d) === selectedDayKey;
    });

    dayOrders.forEach((order) => {
      const orderDate = getOrderDate(order);
      if (!orderDate) return;

      const storedTotal = convertPrice(order.total);
      const deliveryFee = convertPrice(order.deliveryFee);
      const pointsReduction = convertPrice(order.pointsReduction);
      const itemsSubtotal = computeItemsSubtotal(order);
      const hasValidStoredTotal = storedTotal > 0 && storedTotal >= deliveryFee && storedTotal >= itemsSubtotal;
      const totalBeforeReduction = hasValidStoredTotal ? storedTotal : (itemsSubtotal + deliveryFee);
      const finalTotal = Math.max(0, totalBeforeReduction - pointsReduction);

      // Montants par méthode
      let amounts = { cash: 0, om: 0, momo: 0 };
      const p = order?.payment || {};
      const pmMethod = String(p.method || '').toLowerCase();
      if (pmMethod === 'mixed') {
        const cashPart = convertPrice(p.cashAmount || 0);
        const mobilePart = convertPrice(p.mobileAmount || 0);
        const provider = String(p.provider || '').toLowerCase();
        amounts.cash += cashPart;
        if (provider === 'om' || provider.includes('orange')) {
          amounts.om += mobilePart;
        } else if (provider === 'momo' || provider.includes('mtn')) {
          amounts.momo += mobilePart;
        } else {
          amounts.om += mobilePart / 2;
          amounts.momo += mobilePart / 2;
        }
      } else {
        const method = String(derivePaymentMethod(order) ?? '').toLowerCase();
        if (method.includes('cash') || method.includes('espece') || method.includes('espèce')) {
          amounts.cash += finalTotal;
        } else if (method.includes('orange') || method.includes('om')) {
          amounts.om += finalTotal;
        } else if (method.includes('mtn') || method.includes('momo')) {
          amounts.momo += finalTotal;
        } else if (order.isPaid) {
          amounts.om += finalTotal / 2;
          amounts.momo += finalTotal / 2;
        }
      }

      const services = getServices(order);
      const serviceList = services.length ? services : ['Autre'];

      const totalForSplit = Math.max(0, amounts.cash + amounts.om + amounts.momo);
      if (totalForSplit <= 0) return;
      const deliveryRatio = finalTotal > 0 ? (deliveryFee / finalTotal) : 0;
      const serviceRatio = Math.max(0, 1 - deliveryRatio);

      const allocate = (methodKey, amount) => {
        if (amount <= 0) return;
        bucket[methodKey].total += amount;
        const deliveryAlloc = amount * deliveryRatio;
        const serviceAlloc = amount * serviceRatio;
        bucket[methodKey].delivery += deliveryAlloc;
        bucket[methodKey].service += serviceAlloc;
        const perServiceAlloc = serviceList.length ? (serviceAlloc / serviceList.length) : 0;
        for (const s of serviceList) {
          bucket[methodKey].perService.set(s, (bucket[methodKey].perService.get(s) || 0) + perServiceAlloc);
        }
      };

      allocate('cash', amounts.cash);
      allocate('om', amounts.om);
      allocate('momo', amounts.momo);
    });

    const toArr = (map) => Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return {
      cash: { ...bucket.cash, perServiceArr: toArr(bucket.cash.perService) },
      om: { ...bucket.om, perServiceArr: toArr(bucket.om.perService) },
      momo: { ...bucket.momo, perServiceArr: toArr(bucket.momo.perService) },
    };
  }, [orders, selectedDayKey, itemsMap]);

  // Pré sélectionner la première journée disponible
  useEffect(() => {
    if (!selectedDayKey && dailySalesData.length > 0) {
      setSelectedDayKey(dailySalesData[0].date);
    }
  }, [dailySalesData, selectedDayKey]);

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
        {[{
          label: 'Cash', color: 'blue', value: cardMethodTotals.cash.total, service: cardMethodTotals.cash.service, delivery: cardMethodTotals.cash.delivery, icon: DollarSign
        },{
          label: 'Orange Money', color: 'orange', value: cardMethodTotals.om.total, service: cardMethodTotals.om.service, delivery: cardMethodTotals.om.delivery, icon: Smartphone
        },{
          label: 'MTN MOMO', color: 'yellow', value: cardMethodTotals.momo.total, service: cardMethodTotals.momo.service, delivery: cardMethodTotals.momo.delivery, icon: CreditCard
        },{
          label: 'Total', color: 'green', value: (cardMethodTotals.cash.total + cardMethodTotals.om.total + cardMethodTotals.momo.total), service: (cardMethodTotals.cash.service + cardMethodTotals.om.service + cardMethodTotals.momo.service), delivery: (cardMethodTotals.cash.delivery + cardMethodTotals.om.delivery + cardMethodTotals.momo.delivery), icon: TrendingUp
        }].map(({ label, color, value, service, delivery, icon: Icon }) => (
          <div key={label} className={`bg-${color}-50 p-4 rounded-lg`}>
            <div className="flex items-center">
              <Icon className={`w-5 h-5 text-${color}-600 mr-2`} />
              <span className={`text-sm font-medium text-${color}-800`}>{label}</span>
            </div>
            <p className={`text-lg font-bold text-${color}-900 mt-1`}>{formatPrice(value)} FCFA</p>
            <div className="text-xs text-gray-700 mt-1">
              <span>Services: {formatPrice(service)} FCFA</span>
              <span className="mx-2">•</span>
              <span>
                {Number(delivery) > 0 ? (
                  <>Livraison: {formatPrice(delivery)} FCFA</>
                ) : (
                  <>pas de frais de livraison</>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Décomposition par moyen de paiement */}
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {[
          { key: 'cash', label: 'Cash', color: 'blue' },
          { key: 'om', label: 'Orange Money', color: 'orange' },
          { key: 'momo', label: 'MTN MOMO', color: 'yellow' },
        ].map(({ key, label, color }) => {
          const data = paymentMethodBreakdown[key];
          if (!data || data.total <= 0) return null;
          return (
            <div key={key} className="bg-white border rounded-lg p-4">
              <div className={`text-sm font-semibold text-${color}-700 mb-2`}>{label} — {formatPrice(data.total)} FCFA</div>
              <div className="text-xs text-gray-600 mb-2">
                <span>Services: {formatPrice(data.service)} FCFA</span>
                <span className="mx-2">•</span>
                <span>Frais livraison: {formatPrice(data.delivery)} FCFA</span>
              </div>
              <div className="max-h-48 overflow-auto text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1 pr-2">Service/Menu</th>
                      <th className="py-1 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perServiceArr.slice(0, 10).map(([svc, amt]) => (
                      <tr key={svc} className="border-b last:border-0">
                        <td className="py-1 pr-2 truncate" title={svc}>{svc}</td>
                        <td className="py-1 text-right">{formatPrice(amt)} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tableau quotidien (cliquable) avec colonnes Menus (services) */}
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
              <th className="text-right py-3 px-4">Livraison</th>
              {dailySalesData[0]?._topMenus?.map((m) => (
                <th key={m} className="text-right py-3 px-4">{m}</th>
              ))}
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
                  className={`border-b hover:bg-gray-50 cursor-pointer ${selectedDayKey === day.date ? 'bg-green-50' : ''}`}
                  onClick={() => setSelectedDayKey(day.date)}
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
                  <td className="py-3 px-4 text-right">
                    {formatPrice(day.deliverySum || 0)} FCFA
                  </td>
                  {day._topMenus?.map((m) => (
                    <td key={m} className="py-3 px-4 text-right">
                      {formatPrice((day._menuTotals?.get(m) || 0))} FCFA
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Détail par jour sélectionné: split par méthode: Services (Menus) vs Livraison */}
      {selectedDayKey && (
        <div className="mt-6">
          <div className="text-sm text-gray-700 mb-2">
            Détail pour le {formatLocalDate(parseLocalDateKey(selectedDayKey))} — Services = Menus
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { key: 'cash', label: 'Cash', color: 'blue' },
              { key: 'om', label: 'Orange Money', color: 'orange' },
              { key: 'momo', label: 'MTN MOMO', color: 'yellow' },
            ].map(({ key, label, color }) => {
              const data = paymentMethodBreakdown[key];
              if (!data || data.total <= 0) return null;
              return (
                <div key={key} className="bg-white border rounded-lg p-4">
                  <div className={`text-sm font-semibold text-${color}-700 mb-2`}>{label} — {formatPrice(data.total)} FCFA</div>
                  <div className="text-xs text-gray-600 mb-2">
                    <span>Services (Menus): {formatPrice(data.service)} FCFA</span>
                    <span className="mx-2">•</span>
                    <span>
                      {Number(data.delivery) > 0 ? (
                        <>Frais livraison: {formatPrice(data.delivery)} FCFA</>
                      ) : (
                        <>pas de frais de livraison</>
                      )}
                    </span>
                  </div>
                  <div className="max-h-48 overflow-auto text-sm">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-1 pr-2">Menu</th>
                          <th className="py-1 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.perServiceArr.slice(0, 12).map(([svc, amt]) => (
                          <tr key={svc} className="border-b last:border-0">
                            <td className="py-1 pr-2 truncate" title={svc}>{svc}</td>
                            <td className="py-1 text-right">{formatPrice(amt)} FCFA</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
