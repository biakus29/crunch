import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FaEdit,
  FaSave,
  FaTimes,
  FaPlus,
  FaMinus,
  FaCalculator,
  FaHistory,
  FaCheck,
  FaExclamationTriangle,
  FaInfoCircle,
  FaMoneyBillWave,
  FaWallet,
  FaCreditCard,
  FaMobile,
  FaUniversity
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { formatPrice } from '../../utils/adminUtils';

const AccountAdjustmentManager = ({ userRole }) => {
  // États pour les comptes
  const [accounts, setAccounts] = useState([
    {
      id: 'cash',
      name: 'Caisse Principale',
      type: 'cash',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Caisse principale du restaurant'
    },
    {
      id: 'om_seed',
      name: 'Orange Money SEED',
      type: 'mobile',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Compte Orange Money service SEED'
    },
    {
      id: 'om_mange',
      name: 'Orange Money MANGE',
      type: 'mobile',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Compte Orange Money service MANGE'
    },
    {
      id: 'momo_app',
      name: 'MTN MOMO APP',
      type: 'mobile',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Compte MTN MOMO application mobile'
    },
    {
      id: 'momo_crunch',
      name: 'MTN MOMO CRUNCH',
      type: 'mobile',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Compte MTN MOMO service CRUNCH'
    },
    {
      id: 'bank',
      name: 'Compte Bancaire',
      type: 'bank',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Compte bancaire principal'
    }
  ]);

  // États pour l'interface
  const [editingAccount, setEditingAccount] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('credit'); // credit ou debit
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [adjustmentHistory, setAdjustmentHistory] = useState([]);
  const [dateRange, setDateRange] = useState('30');
  const [sortMode, setSortMode] = useState('date');
  const [simpleMode, setSimpleMode] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState('');
  const [orders, setOrders] = useState([]);
  const [adjustInputs, setAdjustInputs] = useState({}); // { 'YYYY-MM-DD': { cash, om_seed, om_mange, momo_app, momo_crunch, bank } }
  const [recoveryInputs, setRecoveryInputs] = useState({ cash: 0, om_seed: 0, om_mange: 0, momo_app: 0, momo_crunch: 0, bank: 0 }); // Déductions globales
  const [activeTab, setActiveTab] = useState('rapprochement'); // 'rapprochement', 'recouvrement', ou 'sorties'
  const [expenses, setExpenses] = useState([]);
  const [deliveryExpenses, setDeliveryExpenses] = useState([]);
  const [purchaseLists, setPurchaseLists] = useState([]);

  // Icônes par type de compte
  const accountIcons = {
    cash: <FaMoneyBillWave className="text-green-600" />,
    mobile: <FaMobile className="text-orange-600" />,
    bank: <FaUniversity className="text-blue-600" />
  };

  // Couleurs par type de compte
  const accountColors = {
    cash: 'green',
    mobile: 'orange',
    bank: 'blue'
  };

  // Utils date/local key
  const getLocalDateKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const formatLocalDate = (date) => new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

  // Helpers comme dans SalesHistory (condensés)
  const convertPrice = (price) => {
    if (price == null) return 0;
    const str = typeof price === 'string' ? price.replace(/[^\d]/g, '') : price;
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const computeItemsSubtotal = (order) => {
    if (!order?.items || !Array.isArray(order.items)) return 0;
    return order.items.reduce((sum, it) => {
      const qty = Number(it?.quantity || 1);
      const base = convertPrice(it?.price ?? it?.dishPrice ?? 0);
      const extras = Array.isArray(it?.extras) ? it.extras.reduce((eSum, ex) => eSum + convertPrice(ex?.price || 0), 0) : 0;
      return sum + (base + extras) * qty;
    }, 0);
  };

  const derivePaymentMethod = (order) => {
    if (order && typeof order.paymentMethod === 'string') return order.paymentMethod;
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
    if (method === 'bank_transfer') return 'cash';
    return method;
  };

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

  // Calculer le solde total
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, account) => sum + account.currentBalance, 0);
  }, [accounts]);

  // Index des comptes par id
  const accountById = useMemo(() => {
    const map = {};
    accounts.forEach(acc => { map[acc.id] = acc; });
    return map;
  }, [accounts]);

  // Filtrer l'historique par période (comme SalesHistory)
  const filteredAdjustments = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(dateRange));
    return (adjustmentHistory || []).filter(a => {
      const t = new Date(a.timestamp);
      return !isNaN(t) && t >= startDate && t <= endDate;
    });
  }, [adjustmentHistory, dateRange]);

  // Charger les ventes comme SalesHistory selon dateRange
  const loadOrders = useCallback(async () => {
    try {
      setSalesLoading(true);
      setSalesError('');
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(dateRange));

      const deliveredQuery = query(
        collection(db, 'orders'),
        where('status', 'in', ['livree', 'delivered']),
        orderBy('timestamp', 'desc')
      );
      const deliveredSnap = await getDocs(deliveredQuery);
      const deliveredData = deliveredSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const takeawayQuery = query(
        collection(db, 'orders'),
        where('type', '==', 'takeaway'),
        orderBy('createdAt', 'desc')
      );
      const takeawaySnap = await getDocs(takeawayQuery);
      const takeawayData = takeawaySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const merged = [...deliveredData, ...takeawayData].filter((order) => {
        const od = getOrderDate(order);
        return od && od >= startDate && od <= endDate;
      });

      setOrders(merged);
    } catch (err) {
      console.error('Erreur chargement ventes:', err);
      setSalesError('Impossible de charger les ventes');
    } finally {
      setSalesLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Charger les sorties (dépenses + achats)
  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(dateRange));

        // Dépenses générales
        const expQuery = query(collection(db, 'expenses'), orderBy('date', 'desc'));
        const expSnap = await getDocs(expQuery);
        const expData = expSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date || null,
          type: 'expense'
        })).filter(e => {
          const d = e.date ? new Date(e.date) : null;
          return d && d >= startDate && d <= endDate;
        });
        setExpenses(expData);

        // Dépenses livraison
        const delivExpQuery = collection(db, 'deliveryExpenses');
        const delivExpSnap = await getDocs(delivExpQuery);
        const delivExpData = delivExpSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date ? (doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)) : null,
          type: 'deliveryExpense'
        })).filter(e => {
          const d = e.date;
          return d && d >= startDate && d <= endDate;
        });
        setDeliveryExpenses(delivExpData);

        // Achats cuisine
        const purchQuery = query(collection(db, 'purchaseLists'), orderBy('date', 'desc'));
        const purchSnap = await getDocs(purchQuery);
        const purchData = purchSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date || null,
          type: 'purchase',
          total: doc.data().total || (doc.data().items ? doc.data().items.reduce((sum, item) => sum + (item.totalPrice || 0), 0) : 0)
        })).filter(p => {
          const d = p.date ? new Date(p.date) : null;
          return d && d >= startDate && d <= endDate;
        });
        setPurchaseLists(purchData);
      } catch (err) {
        console.error('Erreur chargement sorties:', err);
      }
    };
    loadExpenses();
  }, [dateRange]);

  // Agrégation journalière des ventes par mode de paiement
  const dailySalesData = useMemo(() => {
    const salesByDay = {};
    (orders || []).forEach(order => {
      const orderDate = getOrderDate(order);
      if (!orderDate) return;
      const dateKey = getLocalDateKey(orderDate);
      if (!salesByDay[dateKey]) {
        salesByDay[dateKey] = { date: dateKey, totalCash: 0, totalOM: 0, totalMOMO: 0, totalDaily: 0 };
      }
      const storedTotal = convertPrice(order.total);
      const deliveryFee = convertPrice(order.deliveryFee);
      const pointsReduction = convertPrice(order.pointsReduction);
      const itemsSubtotal = computeItemsSubtotal(order);
      let computedTotal = itemsSubtotal + deliveryFee;
      const hasValidStoredTotal = storedTotal > 0 && storedTotal >= deliveryFee && storedTotal >= itemsSubtotal;
      const totalBeforeReduction = hasValidStoredTotal ? storedTotal : computedTotal;
      const finalTotal = Math.max(0, totalBeforeReduction - pointsReduction);
      const method = String(derivePaymentMethod(order) ?? '').toLowerCase();
      if (method.includes('cash') || method.includes('espece') || method.includes('espèce')) {
        salesByDay[dateKey].totalCash += finalTotal;
      } else if (method.includes('orange') || method.includes('om')) {
        salesByDay[dateKey].totalOM += finalTotal;
      } else if (method.includes('mtn') || method.includes('momo')) {
        salesByDay[dateKey].totalMOMO += finalTotal;
      } else if (order.isPaid) {
        salesByDay[dateKey].totalOM += finalTotal / 2;
        salesByDay[dateKey].totalMOMO += finalTotal / 2;
      }
      salesByDay[dateKey].totalDaily += finalTotal;
    });
    const arr = Object.values(salesByDay);
    if (sortMode === 'weekday') {
      const weekdayRank = (key) => {
        const d = new Date(key);
        const day = d.getDay();
        return day === 0 ? 7 : day;
      };
      arr.sort((a, b) => weekdayRank(a.date) - weekdayRank(b.date));
    } else {
      arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return arr;
  }, [orders, sortMode]);

  // Différentiel Ventes vs Ajustements (par jour)
  const dailyDiff = useMemo(() => {
    // Agréger les ajustements par jour (comme dailyAdjustData mais inline)
    const adjAgg = {};
    (filteredAdjustments || []).forEach(adj => {
      const key = getLocalDateKey(adj.timestamp);
      const sign = adj.type === 'debit' ? -1 : 1;
      const acc = accountById[adj.accountId];
      if (!adjAgg[key]) adjAgg[key] = { cash: 0, om: 0, mtn: 0, total: 0 };
      const amount = (parseFloat(adj.amount) || 0) * sign;
      if (acc?.id === 'cash') adjAgg[key].cash += amount;
      else if (acc?.id === 'om') adjAgg[key].om += amount;
      else if (acc?.id === 'mtn') adjAgg[key].mtn += amount;
      else if (acc?.id === 'bank') {/* banque n'entre pas dans OM/MOMO/Cash */}
      adjAgg[key].total += amount;
    });

    // Union des jours ventes/ajustements
    const dayKeys = new Set([
      ...dailySalesData.map(d => d.date),
      ...Object.keys(adjAgg)
    ]);

    const rows = Array.from(dayKeys).map(k => {
      const sales = dailySalesData.find(d => d.date === k) || { totalCash: 0, totalOM: 0, totalMOMO: 0, totalDaily: 0 };
      const adj = adjAgg[k] || { cash: 0, om: 0, mtn: 0, total: 0 };
      return {
        key: k,
        label: formatLocalDate(k),
        cashDiff: (sales.totalCash || 0) - (adj.cash || 0),
        omDiff: (sales.totalOM || 0) - (adj.om || 0),
        momoDiff: (sales.totalMOMO || 0) - (adj.mtn || 0),
        totalDiff: (sales.totalDaily || 0) - (adj.total || 0)
      };
    });

    rows.sort((a, b) => new Date(b.key) - new Date(a.key));
    return rows;
  }, [dailySalesData, filteredAdjustments, accountById]);

  // Agrégation journalière des ajustements par compte (net: crédit - débit)
  const dailyAdjustData = useMemo(() => {
    const agg = {};
    filteredAdjustments.forEach(adj => {
      const key = getLocalDateKey(adj.timestamp);
      const sign = adj.type === 'debit' ? -1 : 1;
      const acc = accountById[adj.accountId];
      if (!agg[key]) {
        agg[key] = { dateKey: key, cash: 0, om: 0, mtn: 0, bank: 0, total: 0 };
      }
      const amount = (parseFloat(adj.amount) || 0) * sign;
      if (acc?.id === 'cash') agg[key].cash += amount;
      else if (acc?.id === 'om') agg[key].om += amount;
      else if (acc?.id === 'mtn') agg[key].mtn += amount;
      else if (acc?.id === 'bank') agg[key].bank += amount;
      agg[key].total += amount;
    });
    // Convertir en tableau + tri (par date ou par jour de semaine)
    const arr = Object.values(agg);
    if (sortMode === 'weekday') {
      const weekdayRank = (key) => {
        const d = new Date(key);
        const day = d.getDay();
        return day === 0 ? 7 : day; // Dimanche après Samedi
      };
      arr.sort((a, b) => weekdayRank(a.dateKey) - weekdayRank(b.dateKey));
    } else {
      arr.sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));
    }
    return arr;
  }, [filteredAdjustments, accountById, sortMode]);

  // Totaux (comme SalesHistory)
  const totals = useMemo(() => (
    dailyAdjustData.reduce(
      (acc, d) => ({
        totalCash: acc.totalCash + d.cash,
        totalOM: acc.totalOM + d.om,
        totalMOMO: acc.totalMOMO + d.mtn,
        totalBank: acc.totalBank + d.bank,
        totalDaily: acc.totalDaily + d.total
      }),
      { totalCash: 0, totalOM: 0, totalMOMO: 0, totalBank: 0, totalDaily: 0 }
    )
  ), [dailyAdjustData]);

  // Préremplissage des inputs depuis l'agrégat existant
  useEffect(() => {
    const initial = {};
    dailyAdjustData.forEach((d) => {
      initial[d.dateKey] = {
        cash: Number((adjustInputs[d.dateKey]?.cash ?? d.cash) || 0),
        om: Number((adjustInputs[d.dateKey]?.om ?? d.om) || 0),
        mtn: Number((adjustInputs[d.dateKey]?.mtn ?? d.mtn) || 0),
      };
    });
    setAdjustInputs((prev) => ({ ...initial, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyAdjustData.length]);

  const handleAdjustChange = (dateKey, field, value) => {
    const num = parseFloat(value);
    setAdjustInputs((prev) => ({
      ...prev,
      [dateKey]: { ...prev[dateKey], [field]: isNaN(num) ? 0 : num },
    }));
  };

  // Gérer l'édition d'un compte
  const handleEditAccount = (account) => {
    setEditingAccount(account.id);
  };

  // Sauvegarder les modifications d'un compte
  const handleSaveAccount = (accountId, newBalance) => {
    setAccounts(prev => prev.map(account => 
      account.id === accountId 
        ? { 
            ...account, 
            currentBalance: parseFloat(newBalance) || 0,
            lastUpdated: new Date()
          }
        : account
    ));
    setEditingAccount(null);
    toast.success('Solde mis à jour avec succès');
  };

  // Annuler l'édition
  const handleCancelEdit = () => {
    setEditingAccount(null);
  };

  // Ouvrir le modal d'ajustement
  const handleOpenAdjustment = (account) => {
    setSelectedAccount(account);
    setShowAdjustmentModal(true);
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustmentType('credit');
  };

  // Fermer le modal d'ajustement
  const handleCloseAdjustment = () => {
    setShowAdjustmentModal(false);
    setSelectedAccount(null);
    setAdjustmentAmount('');
    setAdjustmentReason('');
  };

  // Effectuer un ajustement
  const handleApplyAdjustment = () => {
    if (!selectedAccount || !adjustmentAmount || !adjustmentReason) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Le montant doit être un nombre positif');
      return;
    }

    const newBalance = adjustmentType === 'credit' 
      ? selectedAccount.currentBalance + amount
      : selectedAccount.currentBalance - amount;

    if (newBalance < 0) {
      toast.error('Le solde ne peut pas être négatif');
      return;
    }

    // Mettre à jour le compte
    setAccounts(prev => prev.map(account => 
      account.id === selectedAccount.id 
        ? { 
            ...account, 
            currentBalance: newBalance,
            lastUpdated: new Date()
          }
        : account
    ));

    // Ajouter à l'historique
    const adjustment = {
      id: Date.now(),
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      type: adjustmentType,
      amount: amount,
      reason: adjustmentReason,
      timestamp: new Date(),
      newBalance: newBalance
    };

    setAdjustmentHistory(prev => [adjustment, ...prev.slice(0, 49)]); // Garder les 50 derniers

    toast.success(`Ajustement de ${formatPrice(amount)} appliqué avec succès`);
    handleCloseAdjustment();
  };

  // Formater la date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec contrôles période */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">💰 État des Caisses</h2>
            <p className="text-gray-600 text-sm">Suivi et rapprochement des ventes, ajustements et recouvrements</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="365">1 an</option>
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date">Par date ↓</option>
              <option value="weekday">Par jour (Lun→Dim)</option>
            </select>
          </div>
        </div>

        {/* Cartes résumé */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            { label: 'Cash', color: 'blue', icon: '💵', value: dailySalesData.reduce((s, d) => s + d.totalCash, 0) },
            { label: 'OM SEED', color: 'orange', icon: '📱', value: dailySalesData.reduce((s, d) => s + d.totalOM, 0) / 2 },
            { label: 'OM MANGE', color: 'orange', icon: '📱', value: dailySalesData.reduce((s, d) => s + d.totalOM, 0) / 2 },
            { label: 'MOMO APP', color: 'yellow', icon: '💳', value: dailySalesData.reduce((s, d) => s + d.totalMOMO, 0) / 2 },
            { label: 'MOMO CRUNCH', color: 'yellow', icon: '💳', value: dailySalesData.reduce((s, d) => s + d.totalMOMO, 0) / 2 },
            { label: 'Total Ventes', color: 'green', icon: '💰', value: dailySalesData.reduce((s, d) => s + d.totalDaily, 0) },
          ].map(({ label, color, icon, value }) => (
            <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{icon}</span>
                <span className={`text-xs font-medium text-${color}-700 uppercase tracking-wide`}>{label}</span>
              </div>
              <p className={`text-2xl font-bold text-${color}-900`}>{formatPrice(value)}</p>
              <p className="text-xs text-gray-500 mt-1">FCFA</p>
            </div>
          ))}
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('rapprochement')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'rapprochement'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Rapprochement
            </button>
            <button
              onClick={() => setActiveTab('recouvrement')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'recouvrement'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💼 Recouvrement
            </button>
            <button
              onClick={() => setActiveTab('sorties')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'sorties'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              💸 Sorties
            </button>
          </div>
        </div>

        {/* Contenu Tab Rapprochement */}
        {activeTab === 'rapprochement' && (
        <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">📊 Tableau de rapprochement</h3>
          {salesLoading && <span className="text-sm text-gray-500">Chargement...</span>}
          {salesError && <span className="text-sm text-red-600">{salesError}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 border-b-2 border-gray-200">Date</th>
                <th colSpan="6" className="text-center py-3 px-4 font-semibold text-blue-700 border-b-2 border-blue-200 bg-blue-50">Ventes Automatiques</th>
                <th colSpan="6" className="text-center py-3 px-4 font-semibold text-orange-700 border-b-2 border-orange-200 bg-orange-50">Ajustements Manuels</th>
                <th className="text-center py-3 px-4 font-semibold text-green-700 border-b-2 border-green-200 bg-green-50">Différence</th>
              </tr>
              <tr className="bg-gray-50 text-xs">
                <th className="py-2 px-4"></th>
                <th className="text-right py-2 px-4 text-gray-600">Cash</th>
                <th className="text-right py-2 px-4 text-gray-600">OM SEED</th>
                <th className="text-right py-2 px-4 text-gray-600">OM MANGE</th>
                <th className="text-right py-2 px-4 text-gray-600">MOMO APP</th>
                <th className="text-right py-2 px-4 text-gray-600">MOMO CRUNCH</th>
                <th className="text-right py-2 px-4 text-gray-600">Total</th>
                <th className="text-right py-2 px-4 text-gray-600">Cash</th>
                <th className="text-right py-2 px-4 text-gray-600">OM SEED</th>
                <th className="text-right py-2 px-4 text-gray-600">OM MANGE</th>
                <th className="text-right py-2 px-4 text-gray-600">MOMO APP</th>
                <th className="text-right py-2 px-4 text-gray-600">MOMO CRUNCH</th>
                <th className="text-right py-2 px-4 text-gray-600">Total</th>
                <th className="text-right py-2 px-4 text-gray-600">Δ</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Jours unifiés à partir des ventes et des ajustements
                const dayKeys = new Set([
                  ...dailySalesData.map((d) => d.date),
                  ...dailyAdjustData.map((a) => a.dateKey),
                ]);
                const rows = Array.from(dayKeys)
                  .sort((a, b) => new Date(b) - new Date(a))
                  .map((k, i) => {
                    const s = dailySalesData.find((d) => d.date === k) || { totalCash: 0, totalOM: 0, totalMOMO: 0, totalDaily: 0 };
                    const a = dailyAdjustData.find((d) => d.dateKey === k) || { cash: 0, om_seed: 0, om_mange: 0, momo_app: 0, momo_crunch: 0 };
                    const inp = adjustInputs[k] || { cash: a.cash || 0, om_seed: a.om_seed || 0, om_mange: a.om_mange || 0, momo_app: a.momo_app || 0, momo_crunch: a.momo_crunch || 0 };
                    const autoTotal = (s.totalCash || 0) + (s.totalOM || 0) + (s.totalMOMO || 0);
                    const adjTotal = (Number(inp.cash) || 0) + (Number(inp.om_seed) || 0) + (Number(inp.om_mange) || 0) + (Number(inp.momo_app) || 0) + (Number(inp.momo_crunch) || 0);
                    const diff = autoTotal - adjTotal;
                    return (
                      <motion.tr key={k} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="border-b border-gray-100 hover:bg-blue-50/30">
                        <td className="py-3 px-4 font-medium text-gray-700">{formatLocalDate(k)}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{formatPrice(s.totalCash)}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{formatPrice(s.totalOM / 2)}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{formatPrice(s.totalOM / 2)}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{formatPrice(s.totalMOMO / 2)}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{formatPrice(s.totalMOMO / 2)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-blue-700 bg-blue-50/50">{formatPrice(autoTotal)}</td>
                        <td className="py-2 px-4 text-right bg-orange-50/30"><input type="number" className="w-20 border border-gray-300 rounded px-1 py-1 text-xs text-right focus:ring-2 focus:ring-orange-400 focus:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={inp.cash || ''} onChange={(e) => handleAdjustChange(k, 'cash', e.target.value)} placeholder="" /></td>
                        <td className="py-2 px-4 text-right bg-orange-50/30"><input type="number" className="w-20 border border-gray-300 rounded px-1 py-1 text-xs text-right focus:ring-2 focus:ring-orange-400 focus:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={inp.om_seed || ''} onChange={(e) => handleAdjustChange(k, 'om_seed', e.target.value)} placeholder="" /></td>
                        <td className="py-2 px-4 text-right bg-orange-50/30"><input type="number" className="w-20 border border-gray-300 rounded px-1 py-1 text-xs text-right focus:ring-2 focus:ring-orange-400 focus:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={inp.om_mange || ''} onChange={(e) => handleAdjustChange(k, 'om_mange', e.target.value)} placeholder="" /></td>
                        <td className="py-2 px-4 text-right bg-orange-50/30"><input type="number" className="w-20 border border-gray-300 rounded px-1 py-1 text-xs text-right focus:ring-2 focus:ring-orange-400 focus:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={inp.momo_app || ''} onChange={(e) => handleAdjustChange(k, 'momo_app', e.target.value)} placeholder="" /></td>
                        <td className="py-2 px-4 text-right bg-orange-50/30"><input type="number" className="w-20 border border-gray-300 rounded px-1 py-1 text-xs text-right focus:ring-2 focus:ring-orange-400 focus:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={inp.momo_crunch || ''} onChange={(e) => handleAdjustChange(k, 'momo_crunch', e.target.value)} placeholder="" /></td>
                        <td className="py-3 px-4 text-right font-semibold text-orange-700 bg-orange-50/50">{formatPrice(adjTotal)}</td>
                        <td className={`py-3 px-4 text-right font-bold ${diff >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>{diff >= 0 ? '+' : ''}{formatPrice(diff)}</td>
                      </motion.tr>
                    );
                  });
                return rows.length ? rows : (
                  <tr>
                    <td colSpan="14" className="text-center py-6 text-gray-500">Aucune donnée sur la période.</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>💡 Astuce:</strong> Saisissez vos montants réels dans les colonnes "Ajustements Manuels". La colonne "Différence" affiche l'écart automatiquement.
        </div>
        </div>
        )}

        {/* Contenu Tab Recouvrement */}
        {activeTab === 'recouvrement' && (
        <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">💼 Recouvrement par compte (Déductions)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { id: 'cash', label: 'Caisse', icon: '💵', color: 'blue', field: 'cash' },
            { id: 'om_seed', label: 'OM SEED', icon: '📱', color: 'orange', field: 'om_seed' },
            { id: 'om_mange', label: 'OM MANGE', icon: '📱', color: 'orange', field: 'om_mange' },
            { id: 'momo_app', label: 'MOMO APP', icon: '💳', color: 'yellow', field: 'momo_app' },
            { id: 'momo_crunch', label: 'MOMO CRUNCH', icon: '💳', color: 'yellow', field: 'momo_crunch' },
            { id: 'bank', label: 'Banque', icon: '🏦', color: 'purple', field: 'bank' },
          ].map(({ id, label, icon, color, field }) => {
            const salesTotal = dailySalesData.reduce((s, d) => s + (d[`total${field === 'cash' ? 'Cash' : field === 'om' ? 'OM' : field === 'mtn' ? 'MOMO' : 'Daily'}`] || 0), 0);
            const adjustTotal = Object.values(adjustInputs).reduce((sum, inp) => sum + (Number(inp[field]) || 0), 0);
            const recovery = Number(recoveryInputs[field]) || 0;
            const netBalance = adjustTotal - recovery;
            return (
              <div key={id} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{icon}</span>
                  <span className={`text-xs font-medium text-${color}-700 uppercase tracking-wide`}>{label}</span>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">Ajustements: <span className="font-semibold">{formatPrice(adjustTotal)}</span></div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Recouvrement:</label>
                    <input
                      type="number"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:ring-2 focus:ring-${color}-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={recoveryInputs[field] || ''}
                      onChange={(e) => setRecoveryInputs(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="pt-2 border-t border-${color}-200">
                    <div className="text-xs text-gray-500">Solde net:</div>
                    <p className={`text-xl font-bold ${netBalance >= 0 ? `text-${color}-900` : 'text-red-600'}`}>{formatPrice(netBalance)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <strong>⚠️ Note:</strong> Le recouvrement est déduit des ajustements pour calculer le solde net par compte.
        </div>
        </div>
        )}

        {/* Contenu Tab Sorties */}
        {activeTab === 'sorties' && (
        <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">💸 Historique des sorties</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Département</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Montant</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const allSorties = [
                  ...expenses.map(e => ({ ...e, sortDate: e.date ? new Date(e.date) : new Date(0) })),
                  ...deliveryExpenses.map(e => ({ ...e, sortDate: e.date || new Date(0) })),
                  ...purchaseLists.map(p => ({ ...p, sortDate: p.date ? new Date(p.date) : new Date(0) }))
                ].sort((a, b) => b.sortDate - a.sortDate);

                if (allSorties.length === 0) {
                  return (
                    <tr>
                      <td colSpan="5" className="text-center py-6 text-gray-500">Aucune sortie sur la période.</td>
                    </tr>
                  );
                }

                const totalSorties = allSorties.reduce((sum, s) => sum + (s.type === 'purchase' ? s.total : s.amount || 0), 0);

                return (
                  <>
                    {allSorties.map((sortie, i) => {
                      const dateStr = sortie.date ? (sortie.date instanceof Date ? sortie.date : new Date(sortie.date)).toLocaleDateString('fr-FR') : 'N/A';
                      const typeLabel = sortie.type === 'expense' ? 'Dépense' : sortie.type === 'deliveryExpense' ? 'Dépense Livraison' : 'Achat Cuisine';
                      const description = sortie.description || sortie.notes || sortie.category || 'N/A';
                      const department = sortie.department || (sortie.type === 'deliveryExpense' ? 'Livraison' : sortie.type === 'purchase' ? 'Cuisine' : 'Général');
                      const amount = sortie.type === 'purchase' ? sortie.total : sortie.amount || 0;
                      return (
                        <motion.tr key={sortie.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-700">{dateStr}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              sortie.type === 'expense' ? 'bg-red-100 text-red-700' :
                              sortie.type === 'deliveryExpense' ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>{typeLabel}</span>
                          </td>
                          <td className="py-3 px-4 text-gray-700">{description}</td>
                          <td className="py-3 px-4 text-gray-600">{department}</td>
                          <td className="py-3 px-4 text-right font-semibold text-red-600">{formatPrice(amount)} FCFA</td>
                        </motion.tr>
                      );
                    })}
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan="4" className="py-3 px-4 text-right">Total des sorties:</td>
                      <td className="py-3 px-4 text-right text-red-700">{formatPrice(totalSorties)} FCFA</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <strong>📊 Info:</strong> Ce tableau affiche toutes les sorties (dépenses et achats) sur la période sélectionnée.
        </div>
        </div>
        )}
      </div>

      {/* Historique des ajustements */}
      {adjustmentHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FaHistory className="mr-2 text-gray-600" />
            Historique des Ajustements
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {adjustmentHistory.map((adjustment) => (
              <div key={adjustment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    adjustment.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {adjustment.type === 'credit' ? <FaPlus /> : <FaMinus />}
                  </div>
                  <div>
                    <div className="font-medium">{adjustment.accountName}</div>
                    <div className="text-sm text-gray-600">{adjustment.reason}</div>
                    <div className="text-xs text-gray-500">{formatDate(adjustment.timestamp)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${
                    adjustment.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {adjustment.type === 'credit' ? '+' : '-'}{formatPrice(adjustment.amount)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Solde: {formatPrice(adjustment.newBalance)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal d'ajustement */}
      {showAdjustmentModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Ajuster le Compte</h3>
              <button
                onClick={handleCloseAdjustment}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compte
                </label>
                <div className="p-3 bg-gray-50 rounded flex items-center space-x-3">
                  {accountIcons[selectedAccount.type]}
                  <div>
                    <div className="font-medium">{selectedAccount.name}</div>
                    <div className="text-sm text-gray-500">
                      Solde actuel: {formatPrice(selectedAccount.currentBalance)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'ajustement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAdjustmentType('credit')}
                    className={`p-3 rounded border-2 flex items-center justify-center ${
                      adjustmentType === 'credit'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <FaPlus className="mr-2" />
                    Crédit (+)
                  </button>
                  <button
                    onClick={() => setAdjustmentType('debit')}
                    className={`p-3 rounded border-2 flex items-center justify-center ${
                      adjustmentType === 'debit'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <FaMinus className="mr-2" />
                    Débit (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant (FCFA)
                </label>
                <input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Entrez le montant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raison de l'ajustement
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Décrivez la raison de cet ajustement..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleApplyAdjustment}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
                >
                  <FaCheck className="mr-2" />
                  Appliquer
                </button>
                <button
                  onClick={handleCloseAdjustment}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center"
                >
                  <FaTimes className="mr-2" />
                  Annuler
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AccountAdjustmentManager;
