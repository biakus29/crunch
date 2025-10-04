import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import {
  FaCalendarAlt,
  FaChartLine,
  FaDownload,
  FaMoneyBillWave,
  FaReceipt,
  FaShoppingCart,
  FaTruck,
  FaFileExport,
  FaFilter,
  FaPrint,
  FaEye,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaUser,
  FaClock,
  FaMapMarkerAlt,
  FaStar
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { formatPrice, calculateOrderTotals } from '../../utils/adminUtils';

const AccountingReports = ({ orders = [], items = [], extraLists = [], userRole }) => {
  // Vérification de sécurité pour les props
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeItems = Array.isArray(items) ? items : [];
  const safeExtraLists = Array.isArray(extraLists) ? extraLists : [];
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  
  // Filtres avancés
  const [delivererFilter, setDelivererFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [minRating, setMinRating] = useState(0);

  // Données supplémentaires
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [deliverers, setDeliverers] = useState([]);

  // Types de rapports
  const reportTypes = [
    { id: 'daily', label: 'Journalier', icon: FaCalendarAlt, color: 'blue' },
    { id: 'weekly', label: 'Hebdomadaire', icon: FaChartLine, color: 'green' },
    { id: 'monthly', label: 'Mensuel', icon: FaMoneyBillWave, color: 'purple' },
    { id: 'all', label: 'Toutes les périodes', icon: FaChartLine, color: 'gray' }
  ];

  // Charger les données supplémentaires (dépenses et achats seulement)
  useEffect(() => {
    const loadAdditionalData = async () => {
    try {
      setLoading(true);

      // Charger les dépenses
        const expensesQuery = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
        const expensesSnapshot = await getDocs(expensesQuery);
        const expensesData = expensesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        setExpenses(expensesData);

      // Charger les achats
        const purchasesQuery = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
        const purchasesSnapshot = await getDocs(purchasesQuery);
        const purchasesData = purchasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        setPurchases(purchasesData);

    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

    loadAdditionalData();
  }, []);

  // Debug: Afficher les données reçues
  useEffect(() => {
    if (safeOrders && safeOrders.length > 0) {
      const dates = safeOrders.slice(0, 5).map(order => ({
        id: order.id?.slice(-4),
        date: new Date(order.timestamp).toLocaleDateString('fr-FR'),
        time: new Date(order.timestamp).toLocaleTimeString('fr-FR')
      }));
      
    }
  }, [safeOrders, safeItems, safeExtraLists]);

  // Fonction getPeriodRange copiée de ReportsDashboard
  const getPeriodRange = (date, mode) => {
    if (!date) return { start: null, end: null };
    const d = new Date(date);
    if (isNaN(d.getTime())) return { start: null, end: null };

    // For "all" mode, no date filtering
    if (mode === 'all') {
      return { start: null, end: null };
    }

    // Normalize time to start of day in local timezone
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);

    if (mode === 'daily') {
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (mode === 'weekly') {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() - start.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: weekStart, end: weekEnd };
    }

    if (mode === 'monthly') {
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      monthStart.setHours(0, 0, 0, 0);
      monthEnd.setHours(23, 59, 59, 999);
      return { start: monthStart, end: monthEnd };
    }

    return { start: null, end: null };
  };

  // Enrichir les commandes comme dans ReportsDashboard
  const enrichedOrders = useMemo(() => {
    if (!Array.isArray(safeOrders)) return [];
    
    return safeOrders
      .map((order) => {
        try {
          if (!order || typeof order !== 'object') return null;
          
          // Utiliser timestamp en priorité, sinon updatedAt comme fallback
          const orderDate = order.timestamp 
            ? new Date(order.timestamp.seconds * 1000) 
            : (order.updatedAt ? new Date(order.updatedAt.seconds * 1000) : null);
          
          const rating = order?.rating?.rating;
          
          // Vérifier que order.items existe avant de calculer les totaux
          if (!order.items || !Array.isArray(order.items)) {
            console.warn(`Order ${order.id} has no items or invalid items array`);
        return {
              id: order.id || `order_${Date.now()}`,
              date: orderDate,
              status: order.status || "Inconnu",
              isPaid: Boolean(order.isPaid),
              assignedDeliverer: order.assignedDeliverer || "Non assigné",
              phone: order?.contact?.phone || order?.address?.phone || "",
              destination: order?.address?.area || order.destination || "",
              subtotal: 0,
              deliveryFee: Number(order.deliveryFee) || 0,
              total: Number(order.total) || 0,
              rating: typeof rating === "number" && !isNaN(rating) ? rating : null,
              paymentMethod: typeof order.paymentMethod === "string" 
                ? order.paymentMethod 
                : (order.paymentMethod?.name || "Inconnu"),
              payment: order.payment,
              originalOrder: order
            };
          }
          
          const totals = calculateOrderTotals(order, safeExtraLists, safeItems);
          
          // Validate date
          if (orderDate && isNaN(orderDate.getTime())) {
            console.warn(`Invalid date for order ${order.id}`);
          }
          
        return {
            id: order.id || `order_${Date.now()}`,
            date: orderDate,
            status: order.status || "Inconnu",
            isPaid: Boolean(order.isPaid),
            assignedDeliverer: order.assignedDeliverer || "Non assigné",
            phone: order?.contact?.phone || order?.address?.phone || "",
            destination: order?.address?.area || order.destination || "",
            subtotal: Number(totals.subtotal) || 0,
            deliveryFee: Number(order.deliveryFee) || 0,
            total: Number(totals.totalWithDelivery) || 0,
            rating: typeof rating === "number" && !isNaN(rating) ? rating : null,
            paymentMethod: typeof order.paymentMethod === "string" 
              ? order.paymentMethod 
              : (order.paymentMethod?.name || "Inconnu"),
            payment: order.payment, // Garder les données de paiement originales
            originalOrder: order // Garder l'ordre original pour les calculs
          };
        } catch (error) {
          console.error(`Error processing order ${order?.id}:`, error);
          return null;
        }
      })
      .filter(Boolean); // Remove null entries
  }, [safeOrders, safeItems, safeExtraLists]);

  // Filtrer les commandes selon la période et les filtres (logique de ReportsDashboard)
  const filteredOrders = useMemo(() => {
    if (!enrichedOrders || enrichedOrders.length === 0) {
      return [];
    }

    // Compute current period range based on selectedDate and reportType
    const { start, end } = getPeriodRange(selectedDate, reportType);

    const filtered = enrichedOrders.filter((order) => {
      // Date validation
      if (!order.date || isNaN(order.date.getTime())) return false;

      // Period filter (if range is valid)
      if (start && end) {
        // Convert order date to local date for comparison
        const orderLocalDate = new Date(order.date);
        orderLocalDate.setHours(0, 0, 0, 0);
        
        // Convert range dates to local dates for comparison
        const startLocal = new Date(start);
        startLocal.setHours(0, 0, 0, 0);
        const endLocal = new Date(end);
        endLocal.setHours(23, 59, 59, 999);
        
        if (orderLocalDate < startLocal || orderLocalDate > endLocal) return false;
      }
      
      // Deliverer filter
      if (delivererFilter !== 'all' && order.assignedDeliverer !== delivererFilter) {
        return false;
      }
      
      // Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }
      
      // Payment Method filter
      if (paymentMethodFilter !== 'all' && order.paymentMethod !== paymentMethodFilter) {
        return false;
      }
      
      // Destination filter
      if (destinationFilter !== 'all' && order.destination !== destinationFilter) {
        return false;
      }
      
      // Payment Status filter
      if (paymentStatusFilter !== 'all' && (
        (paymentStatusFilter === "paid" && !order.isPaid) ||
        (paymentStatusFilter === "unpaid" && order.isPaid)
      )) {
        return false;
      }
      
      // Minimum Rating filter
      if (minRating > 0 && (
        order.rating === null || order.rating < minRating
      )) {
        return false;
      }
      
      return true;
    });
    
    return filtered;
  }, [enrichedOrders, reportType, selectedDate, delivererFilter, statusFilter, paymentMethodFilter, destinationFilter, paymentStatusFilter, minRating]);

  // Calculer les statistiques financières
  const financialStats = useMemo(() => {
    // Vérifier que filteredOrders est un tableau valide
    if (!Array.isArray(filteredOrders) || filteredOrders.length === 0) {
    return { 
        totalRevenue: 0,
        paymentBreakdown: {
          'Orange Money': 0,
          'MTN Mobile Money': 0,
          'Espèces': 0,
          'Virement Bancaire': 0
        },
        totalDeliveryFees: 0,
        totalDiscounts: 0,
        totalExpenses: 0,
        totalPurchases: 0,
        netProfit: 0,
        ordersCount: 0,
        paidOrdersCount: 0,
        averageOrderValue: 0
      };
    }

    // Calculer les totaux manuellement (calculateOrderTotals ne fonctionne que sur une commande individuelle)
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalDeliveryFees = filteredOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
    const totalDiscounts = filteredOrders.reduce((sum, order) => {
      const promoDiscount = Number(order.originalOrder?.promoDiscount) || 0;
      const pointsDiscount = Number(order.originalOrder?.pointsDiscount) || 0;
      const pointsReduction = Number(order.originalOrder?.pointsReduction) || 0;
      return sum + promoDiscount + pointsDiscount + pointsReduction;
    }, 0);
    
    // Revenus par méthode de paiement (format amélioré)
    const paymentBreakdown = {
      'Orange Money': 0,
      'MTN Mobile Money': 0,
      'Espèces': 0,
      'Virement Bancaire': 0
    };

    filteredOrders.forEach(order => {
      if (!order.isPaid) return;

      const payment = order.payment;
      if (payment && typeof payment === 'object' && Object.keys(payment).length > 0) {
        const paymentMethod = payment.method;
        const paymentProvider = payment.provider;
        
        if (paymentMethod === 'mobile_money') {
          if (paymentProvider === 'OM' || paymentProvider === 'Orange Money') {
            paymentBreakdown['Orange Money'] += order.total || 0;
          } else if (paymentProvider === 'MOMO' || paymentProvider === 'MTN') {
            paymentBreakdown['MTN Mobile Money'] += order.total || 0;
          }
        } else if (paymentMethod === 'cash') {
          paymentBreakdown['Espèces'] += order.total || 0;
        } else if (paymentMethod === 'bank_transfer') {
          paymentBreakdown['Virement Bancaire'] += order.total || 0;
        } else if (paymentMethod === 'mixed') {
          paymentBreakdown['Espèces'] += (payment.cashAmount || 0);
          if (paymentProvider === 'OM' || paymentProvider === 'Orange Money') {
            paymentBreakdown['Orange Money'] += (payment.mobileAmount || 0);
          } else if (paymentProvider === 'MOMO' || paymentProvider === 'MTN') {
            paymentBreakdown['MTN Mobile Money'] += (payment.mobileAmount || 0);
          }
        }
      } else {
        // Fallback vers l'ancien format
        const oldPaymentMethod = order.paymentMethod;
        if (oldPaymentMethod && typeof oldPaymentMethod === 'object') {
          const methodName = oldPaymentMethod.name || '';
          if (methodName.includes('Orange')) {
            paymentBreakdown['Orange Money'] += order.total || 0;
          } else if (methodName.includes('MTN')) {
            paymentBreakdown['MTN Mobile Money'] += order.total || 0;
          } else if (methodName.includes('Cash')) {
            paymentBreakdown['Espèces'] += order.total || 0;
          } else if (methodName.includes('Bank')) {
            paymentBreakdown['Virement Bancaire'] += order.total || 0;
          }
        } else if (typeof oldPaymentMethod === 'string') {
          if (oldPaymentMethod.includes('Orange')) {
            paymentBreakdown['Orange Money'] += order.total || 0;
          } else if (oldPaymentMethod.includes('MTN')) {
            paymentBreakdown['MTN Mobile Money'] += order.total || 0;
          } else if (oldPaymentMethod.includes('Cash')) {
            paymentBreakdown['Espèces'] += order.total || 0;
          } else if (oldPaymentMethod.includes('Bank')) {
            paymentBreakdown['Virement Bancaire'] += order.total || 0;
          }
        }
      }
    });

    // Dépenses et achats
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const totalPurchases = purchases.reduce((sum, purchase) => sum + (purchase.total || 0), 0);
    const netProfit = totalRevenue - totalExpenses - totalPurchases;
    
    return {
      totalRevenue,
      paymentBreakdown,
      totalDeliveryFees,
      totalDiscounts,
      totalExpenses,
      totalPurchases,
      netProfit,
      ordersCount: filteredOrders.length,
      paidOrdersCount: filteredOrders.filter(o => o.isPaid).length,
      averageOrderValue: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0
    };
  }, [filteredOrders, expenses, purchases]);

  // Analyse des plats populaires
  const popularDishes = useMemo(() => {
    const dishCounts = {};
    
    filteredOrders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          const dishName = item.dishName || 'Plat inconnu';
          if (!dishCounts[dishName]) {
            dishCounts[dishName] = { count: 0, revenue: 0 };
          }
          dishCounts[dishName].count += item.quantity || 1;
          dishCounts[dishName].revenue += (item.price || 0) * (item.quantity || 1);
        });
      }
    });

    return Object.entries(dishCounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredOrders]);

  // Exporter en CSV
  const exportToCSV = useCallback(() => {
    let csvContent = "Type,Date,Heure,Montant,Méthode de paiement,Statut,Livreur,Description\n";
    
    // Ajouter les commandes
    filteredOrders.forEach(order => {
      const paymentMethod = order.payment?.method || order.paymentMethod?.name || 'Non spécifié';
      const orderTime = new Date(order.timestamp).toLocaleTimeString('fr-FR');
      csvContent += `Commande,${new Date(order.timestamp).toLocaleDateString('fr-FR')},${orderTime},${order.total},${paymentMethod},${order.status},${order.assignedDeliverer || 'Non assigné'},Commande #${order.id?.slice(-4) || 'N/A'}\n`;
    });
    
    // Ajouter les dépenses
    expenses.forEach(expense => {
      const expenseTime = new Date(expense.createdAt).toLocaleTimeString('fr-FR');
      csvContent += `Dépense,${new Date(expense.createdAt).toLocaleDateString('fr-FR')},${expenseTime},-${expense.amount},${expense.paymentMethod || 'Espèces'},Dépense,${expense.department || 'N/A'},${expense.description}\n`;
    });
    
    // Ajouter les achats
    purchases.forEach(purchase => {
      const purchaseTime = new Date(purchase.createdAt).toLocaleTimeString('fr-FR');
      csvContent += `Achat,${new Date(purchase.createdAt).toLocaleDateString('fr-FR')},${purchaseTime},-${purchase.total},${purchase.paymentMethod || 'Espèces'},Achat,${purchase.supplier || 'N/A'},${purchase.description}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_comptable_${reportType}_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Rapport exporté avec succès');
  }, [filteredOrders, expenses, purchases, reportType, selectedDate]);

  // Obtenir les options de filtres (comme dans ReportsDashboard)
  const delivererOptions = useMemo(() => {
    const deliverers = [...new Set(enrichedOrders.map(order => order.assignedDeliverer))].sort();
    return [{ value: 'all', label: 'Tous les livreurs' }, ...deliverers.map(d => ({ value: d, label: d }))];
  }, [enrichedOrders]);

  const destinationOptions = useMemo(() => {
    const destinations = [...new Set(enrichedOrders.map(order => order.destination))].filter(Boolean).sort();
    return [{ value: 'all', label: 'Toutes les destinations' }, ...destinations.map(d => ({ value: d, label: d }))];
  }, [enrichedOrders]);

  const paymentMethodOptions = useMemo(() => {
    const methods = [...new Set(enrichedOrders.map(order => order.paymentMethod))].filter(Boolean).sort();
    return [{ value: 'all', label: 'Toutes les méthodes' }, ...methods.map(m => ({ value: m, label: m }))];
  }, [enrichedOrders]);

  const statusOptions = useMemo(() => {
    const statuses = [...new Set(enrichedOrders.map(order => order.status))].filter(Boolean).sort();
    return [{ value: 'all', label: 'Tous les statuts' }, ...statuses.map(s => ({ value: s, label: s }))];
  }, [enrichedOrders]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
          <div>
          <h2 className="text-2xl font-bold text-gray-900">📊 Rapports Comptables</h2>
          <p className="text-gray-600">Analyse financière complète avec filtres avancés</p>
          <div className="text-sm text-gray-500 mt-1">
            Données: {safeOrders.length} commandes, {filteredOrders.length} filtrées
          </div>
        </div>
          <div className="flex space-x-3">
            <button
            onClick={() => setReportType('all')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
            📊 Voir toutes les commandes
            </button>
            <button
              onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
            >
            <FaDownload className="mr-2" />
            Exporter CSV
            </button>
        </div>
      </div>

      {/* Sélection du type de rapport */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">📅 Période du rapport</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {reportTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setReportType(type.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                reportType === type.id
                  ? `border-${type.color}-500 bg-${type.color}-50`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <type.icon className={`text-2xl text-${type.color}-600`} />
                <div className="text-left">
                  <div className="font-medium text-gray-900">{type.label}</div>
                </div>
              </div>
            </button>
          ))}
              </div>

        {/* Sélecteurs de date */}
        <div className="mt-4 flex flex-wrap gap-4">
          {reportType === 'daily' && (
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded-md px-3 py-2"
              />
                </div>
          )}
          {reportType === 'weekly' && (
                  <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semaine</label>
              <input
                type="week"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="border rounded-md px-3 py-2"
              />
                  </div>
          )}
          {reportType === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mois</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border rounded-md px-3 py-2"
              />
                </div>
                  )}
                </div>
              </div>

      {/* Filtres avancés */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">🔍 Filtres avancés</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Livreur</label>
            <select
              value={delivererFilter}
              onChange={(e) => setDelivererFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              {delivererOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
                      </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
                </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de paiement</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              {paymentMethodOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
              </div>

                  <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
            <select
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              {destinationOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
                </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut de paiement</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="all">Tous</option>
              <option value="paid">Payé</option>
              <option value="unpaid">Non payé</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note minimum</label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value={0}>Toutes les notes</option>
              <option value={1}>1+ étoiles</option>
              <option value={2}>2+ étoiles</option>
              <option value={3}>3+ étoiles</option>
              <option value={4}>4+ étoiles</option>
              <option value={5}>5 étoiles</option>
            </select>
                  </div>
                </div>
              </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm p-6"
        >
          <div className="flex items-center justify-between">
                  <div>
              <p className="text-sm font-medium text-gray-600">Revenus totaux</p>
              <p className="text-2xl font-bold text-green-600">
                {formatPrice(financialStats.totalRevenue)} FCFA
              </p>
              <p className="text-xs text-gray-500">
                {financialStats.ordersCount} commandes
              </p>
                  </div>
            <FaMoneyBillWave className="text-3xl text-green-600" />
                </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm p-6"
        >
          <div className="flex items-center justify-between">
                  <div>
              <p className="text-sm font-medium text-gray-600">Dépenses</p>
              <p className="text-2xl font-bold text-red-600">
                {formatPrice(financialStats.totalExpenses)} FCFA
              </p>
              <p className="text-xs text-gray-500">
                {expenses.length} dépenses
              </p>
                  </div>
            <FaReceipt className="text-3xl text-red-600" />
                </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Achats</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatPrice(financialStats.totalPurchases)} FCFA
              </p>
              <p className="text-xs text-gray-500">
                {purchases.length} achats
              </p>
                      </div>
            <FaShoppingCart className="text-3xl text-orange-600" />
                </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-sm p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Bénéfice net</p>
              <p className={`text-2xl font-bold ${financialStats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPrice(financialStats.netProfit)} FCFA
              </p>
              <p className="text-xs text-gray-500">
                Panier moyen: {formatPrice(financialStats.averageOrderValue)} FCFA
              </p>
                </div>
            <FaEquals className="text-3xl text-blue-600" />
              </div>
        </motion.div>
            </div>

      {/* Revenus par méthode de paiement */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">💳 Revenus par méthode de paiement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(financialStats.paymentBreakdown).map(([method, amount]) => (
            <div key={method} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-800">{method}</div>
                  <div className="text-lg font-bold text-green-600">
                    {formatPrice(amount)} FCFA
          </div>
                  <div className="text-xs text-gray-500">
                    {financialStats.totalRevenue > 0 
                      ? Math.round((amount / financialStats.totalRevenue) * 100) 
                      : 0}% du total
        </div>
      </div>
                <div className="text-2xl">
                  {method === 'Orange Money' && '🟠'}
                  {method === 'MTN Mobile Money' && '🟡'}
                  {method === 'Espèces' && '💵'}
                  {method === 'Virement Bancaire' && '🏦'}
            </div>
          </div>
            </div>
          ))}
          </div>
            </div>

      {/* Plats populaires */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">🍽️ Plats les plus populaires</h3>
        <div className="space-y-3">
          {popularDishes.slice(0, 5).map((dish, index) => (
            <div key={dish.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
            </div>
                <div>
                  <div className="font-medium text-gray-900">{dish.name}</div>
                  <div className="text-sm text-gray-500">
                    {dish.count} commandes • {formatPrice(dish.revenue)} FCFA
            </div>
          </div>
        </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {formatPrice(dish.revenue / dish.count)} FCFA
            </div>
                <div className="text-xs text-gray-500">Prix moyen</div>
          </div>
            </div>
          ))}
        </div>
      </div>

      {/* Résumé des activités */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">📦 Commandes</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total commandes</span>
              <span className="font-medium">{financialStats.ordersCount}</span>
        </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Commandes payées</span>
              <span className="font-medium text-green-600">{financialStats.paidOrdersCount}</span>
      </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Taux de paiement</span>
              <span className="font-medium">
                {financialStats.ordersCount > 0 
                  ? Math.round((financialStats.paidOrdersCount / financialStats.ordersCount) * 100)
                  : 0}%
                    </span>
                  </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Frais de livraison</span>
              <span className="font-medium text-blue-600">
                {formatPrice(financialStats.totalDeliveryFees)} FCFA
              </span>
                  </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Remises accordées</span>
              <span className="font-medium text-orange-600">
                {formatPrice(financialStats.totalDiscounts)} FCFA
              </span>
                </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">💰 Dépenses & Achats</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Nombre de dépenses</span>
              <span className="font-medium text-red-600">{expenses.length}</span>
              </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Nombre d'achats</span>
              <span className="font-medium text-orange-600">{purchases.length}</span>
              </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total sorties</span>
              <span className="font-medium text-red-600">
                {formatPrice(financialStats.totalExpenses + financialStats.totalPurchases)} FCFA
              </span>
              </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Marge bénéficiaire</span>
              <span className={`font-medium ${financialStats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {financialStats.totalRevenue > 0 
                  ? Math.round((financialStats.netProfit / financialStats.totalRevenue) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountingReports;