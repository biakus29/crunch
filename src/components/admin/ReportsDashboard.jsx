import React, { useMemo, useState, useCallback, useEffect } from "react";
import { formatPrice, calculateOrderTotals } from "../../utils/adminUtils";

// Constants for better maintainability
const PERIOD_MODES = {
  DAY: "day",
  WEEK: "week", 
  MONTH: "month",
  ALL: "all"
};

const DEFAULT_DELIVERER = "Non assigné";
const CSV_MIME_TYPE = "text/csv;charset=utf-8;";

// Enhanced date formatting with better error handling
const formatPeriodLabel = (date, mode) => {
  if (!date) return "Période inconnue";
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Date invalide";
    
    const options = { timeZone: 'Africa/Douala' }; // Cameroon timezone
    
    switch (mode) {
      case PERIOD_MODES.DAY:
        return d.toLocaleDateString("fr-FR", options);
      
      case PERIOD_MODES.WEEK: {
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return `${start.toLocaleDateString("fr-FR", options)} → ${end.toLocaleDateString("fr-FR", options)}`;
      }
      
      case PERIOD_MODES.MONTH:
        return d.toLocaleDateString("fr-FR", { 
          month: "long", 
          year: "numeric",
          ...options 
        });
      
      case PERIOD_MODES.ALL:
        return "Toutes les périodes";
      
      default:
        return "Période";
    }
  } catch (error) {
    console.error("Error formatting period label:", error);
    return "Erreur de format";
  }
};

// Compute period start/end according to dateFilterMode
const getPeriodRange = (date, mode) => {
  if (!date) return { start: null, end: null };
  const d = new Date(date);
  if (isNaN(d.getTime())) return { start: null, end: null };

  // For "all" mode, no date filtering
  if (mode === PERIOD_MODES.ALL) {
    return { start: null, end: null };
  }

  // Normalize time to start of day in local timezone
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);

  if (mode === PERIOD_MODES.DAY) {
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (mode === PERIOD_MODES.WEEK) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - start.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { start: weekStart, end: weekEnd };
  }

  if (mode === PERIOD_MODES.MONTH) {
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    monthStart.setHours(0, 0, 0, 0);
    monthEnd.setHours(23, 59, 59, 999);
    return { start: monthStart, end: monthEnd };
  }

  return { start: null, end: null };
};

// Enhanced CSV building with better escaping and validation
const buildCsv = (headers, rows) => {
  if (!Array.isArray(headers) || headers.length === 0) {
    throw new Error("Headers must be a non-empty array");
  }
  
  if (!Array.isArray(rows)) {
    throw new Error("Rows must be an array");
  }

  const escapeValue = (value) => {
    if (value === null || value === undefined) return "";
    
    const stringValue = String(value)
      .replace(/\r?\n/g, " ")
      .trim();
    
    if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  };

  const headerRow = headers.map(escapeValue).join(",");
  const dataRows = rows
    .map(row => headers.map(header => escapeValue(row[header])).join(","))
    .join("\n");
  
  return `${headerRow}\n${dataRows}`;
};

// Enhanced file download with better error handling
const downloadFile = (content, filename, mimeType = CSV_MIME_TYPE) => {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error("Error downloading file:", error);
    throw new Error("Impossible de télécharger le fichier");
  }
};

const filterStyles = {
  container: "flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg",
  label: "text-sm font-medium text-gray-700",
  select: "border border-gray-300 rounded-md px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500",
  input: "border border-gray-300 rounded-md px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500",
  option: "text-sm"
};

// Enhanced loading state component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    <span className="ml-2 text-sm text-gray-600">Génération en cours...</span>
  </div>
);

// Error boundary component
const ErrorDisplay = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-center">
      <div className="text-red-600 text-sm">
        <strong>Erreur:</strong> {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-auto px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
        >
          Réessayer
        </button>
      )}
    </div>
  </div>
);

// Statistics card component for better reusability
const StatCard = ({ label, value, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm p-4 ${className}`}>
    <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
  </div>
);

const ReportsDashboard = ({ 
  orders = [], 
  items = [], 
  extraLists = []
}) => {
  // État pour forcer le rafraîchissement
  const [forceRefresh, setForceRefresh] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  // State management for filters
  const [filterDeliverer, setFilterDeliverer] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [filterDestination, setFilterDestination] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("");
  const [filterMinRating, setFilterMinRating] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState(PERIOD_MODES.DAY); // Default to show today's orders
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Clear error when filters change
  const clearError = useCallback(() => setExportError(null), []);

  // Détecter les changements dans les commandes et forcer le rafraîchissement
  useEffect(() => {
    const currentTime = Date.now();
    if (currentTime - lastUpdate > 1000) { // Éviter les rafraîchissements trop fréquents
      setLastUpdate(currentTime);
      setForceRefresh(prev => prev + 1);
    }
  }, [orders, lastUpdate]);

  // Enhanced order enrichment with better error handling
  const enrichedOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    
    return orders
      .map((order) => {
        try {
          if (!order || typeof order !== 'object') return null;
          
          const totals = calculateOrderTotals(order, extraLists, items);
          // Utiliser timestamp en priorité, sinon updatedAt comme fallback
          const orderDate = order.timestamp 
            ? new Date(order.timestamp.seconds * 1000) 
            : (order.updatedAt ? new Date(order.updatedAt.seconds * 1000) : null);
          
          // Validate date
          if (orderDate && isNaN(orderDate.getTime())) {
            console.warn(`Invalid date for order ${order.id}`);
          }
          
          const rating = order?.rating?.rating;
          
          return {
            id: order.id || `order_${Date.now()}`,
            date: orderDate,
            status: order.status || "Inconnu",
            isPaid: Boolean(order.isPaid),
            assignedDeliverer: order.assignedDeliverer || DEFAULT_DELIVERER,
            phone: order?.contact?.phone || order?.address?.phone || "",
            destination: order?.address?.area || order.destination || "",
            subtotal: Number(totals.subtotal) || 0,
            deliveryFee: Number(order.deliveryFee) || 0,
            total: Number(totals.totalWithDelivery) || 0,
            rating: typeof rating === "number" && !isNaN(rating) ? rating : null,
            paymentMethod: typeof order.paymentMethod === "string" 
              ? order.paymentMethod 
              : (order.paymentMethod?.name || "Inconnu"),
          };
        } catch (error) {
          console.error(`Error processing order ${order?.id}:`, error);
          return null;
        }
      })
      .filter(Boolean); // Remove null entries
  }, [orders, items, extraLists, forceRefresh]);

  // Get unique values for filters
  const uniquePaymentMethods = useMemo(() => {
    return Array.from(new Set(enrichedOrders.map(order => order.paymentMethod)))
      .filter(Boolean)
      .sort();
  }, [enrichedOrders]);

  const uniqueDestinations = useMemo(() => {
    return Array.from(new Set(enrichedOrders.map(order => order.destination)))
      .filter(Boolean)
      .sort();
  }, [enrichedOrders]);

  const uniqueDeliverers = useMemo(() => {
    return Array.from(new Set(enrichedOrders.map(order => order.assignedDeliverer)))
      .sort();
  }, [enrichedOrders]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(enrichedOrders.map(order => order.status)))
      .filter(Boolean)
      .sort();
  }, [enrichedOrders]);

  // Enhanced filtering with all filters
  const filteredOrders = useMemo(() => {
    // Compute current period range based on selectedDate and dateFilterMode
    const { start, end } = getPeriodRange(selectedDate, dateFilterMode);

    return enrichedOrders.filter((order) => {
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
      if (filterDeliverer && order.assignedDeliverer !== filterDeliverer) {
        return false;
      }
      
      // Status filter
      if (filterStatus && order.status !== filterStatus) {
        return false;
      }
      
      // Payment Method filter
      if (filterPaymentMethod && order.paymentMethod !== filterPaymentMethod) {
        return false;
      }
      
      // Destination filter
      if (filterDestination && order.destination !== filterDestination) {
        return false;
      }
      
      // Payment Status filter
      if (filterPaymentStatus && (
        (filterPaymentStatus === "paid" && !order.isPaid) ||
        (filterPaymentStatus === "unpaid" && order.isPaid)
      )) {
        return false;
      }
      
      // Minimum Rating filter
      if (filterMinRating && (
        order.rating === null || order.rating < Number(filterMinRating)
      )) {
        return false;
      }
      
      return true;
    });
  }, [
    enrichedOrders, 
    filterDeliverer, 
    filterStatus, 
    filterPaymentMethod, 
    filterDestination, 
    filterPaymentStatus, 
    filterMinRating, 
    selectedDate, 
    dateFilterMode
  ]);

  // Enhanced aggregation calculations
  const aggregates = useMemo(() => {
    const count = filteredOrders.length;
    const paidCount = filteredOrders.filter(order => order.isPaid).length;
    const revenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const deliveryFees = filteredOrders.reduce((sum, order) => sum + order.deliveryFee, 0);
    const subtotal = filteredOrders.reduce((sum, order) => sum + order.subtotal, 0);

    // Group by deliverer with enhanced statistics
    const delivererStats = {};
    
    filteredOrders.forEach((order) => {
      const delivererName = order.assignedDeliverer || DEFAULT_DELIVERER;
      
      if (!delivererStats[delivererName]) {
        delivererStats[delivererName] = {
          orders: 0,
          revenue: 0,
          paid: 0,
          ratings: [],
          deliveryFees: 0
        };
      }
      
      const stats = delivererStats[delivererName];
      stats.orders += 1;
      stats.revenue += order.total;
      stats.deliveryFees += order.deliveryFee;
      
      if (order.isPaid) stats.paid += 1;
      if (order.rating !== null) stats.ratings.push(order.rating);
    });

    // Convert to sorted array with computed averages
    const delivererArray = Object.entries(delivererStats)
      .map(([name, stats]) => ({
        name,
        orders: stats.orders,
        paid: stats.paid,
        revenue: stats.revenue,
        deliveryFees: stats.deliveryFees,
        avgRating: stats.ratings.length 
          ? stats.ratings.reduce((sum, rating) => sum + rating, 0) / stats.ratings.length 
          : null,
        paymentRate: stats.orders > 0 ? (stats.paid / stats.orders) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      count,
      paidCount,
      revenue,
      deliveryFees,
      subtotal,
      delivererArray,
      paymentRate: count > 0 ? (paidCount / count) * 100 : 0
    };
  }, [filteredOrders, forceRefresh]);

  // Popular dishes analysis
  const dishAnalysis = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return { dishes: [], categories: [] };

    const dishStats = {};
    const categoryStats = {};

    // Use original orders to access orderItems
    orders.forEach((order) => {
      // Check if order is in filtered period
      // Utiliser timestamp en priorité, sinon updatedAt comme fallback
      const orderDate = order.timestamp 
        ? new Date(order.timestamp.seconds * 1000) 
        : (order.updatedAt ? new Date(order.updatedAt.seconds * 1000) : null);
      if (!orderDate || isNaN(orderDate.getTime())) return;
      
      const { start, end } = getPeriodRange(selectedDate, dateFilterMode);
      if (start && end) {
        // Convert order date to local date for comparison
        const orderLocalDate = new Date(orderDate);
        orderLocalDate.setHours(0, 0, 0, 0);
        
        // Convert range dates to local dates for comparison
        const startLocal = new Date(start);
        startLocal.setHours(0, 0, 0, 0);
        const endLocal = new Date(end);
        endLocal.setHours(23, 59, 59, 999);
        
        if (orderLocalDate < startLocal || orderLocalDate > endLocal) return;
      }
      
      if (!order.orderItems || !Array.isArray(order.orderItems)) return;

      order.orderItems.forEach((orderItem) => {
        if (!orderItem || !orderItem.itemId) return;
        
        // Find the corresponding item details
        const item = items.find(i => i.id === orderItem.itemId);
        if (!item) return;
        
        const quantity = Number(orderItem.quantity) || 0;
        const itemTotal = Number(orderItem.price) * quantity || 0;
        
        // Dish statistics
        if (!dishStats[item.id]) {
          dishStats[item.id] = {
            id: item.id,
            name: item.name || 'Plat inconnu',
            category: item.category || 'Non catégorisé',
            price: Number(item.price) || 0,
            totalOrdered: 0,
            totalQuantity: 0,
            totalRevenue: 0,
            averageRating: 0,
            ratings: []
          };
        }
        
        dishStats[item.id].totalOrdered += 1;
        dishStats[item.id].totalQuantity += quantity;
        dishStats[item.id].totalRevenue += itemTotal;
        
        // Add order rating to dish if available
        if (order.rating !== null) {
          dishStats[item.id].ratings.push(order.rating);
        }
        
        // Category statistics
        const category = item.category || 'Non catégorisé';
        if (!categoryStats[category]) {
          categoryStats[category] = {
            name: category,
            totalOrdered: 0,
            totalQuantity: 0,
            totalRevenue: 0,
            uniqueDishes: new Set()
          };
        }
        
        categoryStats[category].totalOrdered += 1;
        categoryStats[category].totalQuantity += quantity;
        categoryStats[category].totalRevenue += itemTotal;
        categoryStats[category].uniqueDishes.add(item.id);
      });
    });

    // Calculate average ratings and convert to arrays
    const dishes = Object.values(dishStats)
      .map(dish => ({
        ...dish,
        averageRating: dish.ratings.length > 0 
          ? dish.ratings.reduce((sum, rating) => sum + rating, 0) / dish.ratings.length 
          : null,
        uniqueDishesCount: undefined,
        ratings: undefined // Remove ratings array to keep object clean
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    const categories = Object.values(categoryStats)
      .map(cat => ({
        ...cat,
        uniqueDishes: cat.uniqueDishes.size,
        uniqueDishesSet: undefined // Remove set to keep object clean
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return { dishes, categories };
  }, [orders, items, selectedDate, dateFilterMode]);

  // Monthly trends analysis (disabled for simplicity)
  const monthlyTrends = null;

  // Enhanced CSV export functions
  const exportOrdersCsv = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);

    try {
      const headers = [
        "id", "date", "status", "isPaid", "paymentMethod", "assignedDeliverer", 
        "phone", "destination", "subtotal", "deliveryFee", "total", "rating"
      ];

      const rows = filteredOrders.map((order) => ({
        ...order,
        date: order.date ? order.date.toLocaleString("fr-FR") : "",
        subtotal: formatPrice(order.subtotal),
        deliveryFee: formatPrice(order.deliveryFee),
        total: formatPrice(order.total),
        rating: order.rating !== null ? order.rating : ""
      }));

      const csv = buildCsv(headers, rows);
      const filename = `commandes_${formatPeriodLabel(selectedDate, dateFilterMode)}_${Date.now()}.csv`;

      downloadFile(csv, filename);
    } catch (error) {
      console.error("CSV export error:", error);
      setExportError("Impossible d'exporter les commandes en CSV");
    } finally {
      setIsExporting(false);
    }
  }, [filteredOrders, selectedDate, dateFilterMode, isExporting]);

  const exportDeliverersCsv = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);

    try {
      const headers = ["name", "orders", "paid", "revenue", "deliveryFees", "avgRating", "paymentRate"];

      const rows = aggregates.delivererArray.map((deliverer) => ({
        name: deliverer.name,
        orders: deliverer.orders,
        paid: deliverer.paid,
        revenue: formatPrice(deliverer.revenue),
        deliveryFees: formatPrice(deliverer.deliveryFees),
        avgRating: deliverer.avgRating !== null ? deliverer.avgRating.toFixed(2) : "",
        paymentRate: deliverer.paymentRate.toFixed(1) + "%"
      }));

      const csv = buildCsv(headers, rows);
      const filename = `livreurs_${formatPeriodLabel(selectedDate, dateFilterMode)}_${Date.now()}.csv`;

      downloadFile(csv, filename);
    } catch (error) {
      console.error("Deliverers CSV export error:", error);
      setExportError("Impossible d'exporter les livreurs en CSV");
    } finally {
      setIsExporting(false);
    }
  }, [aggregates.delivererArray, selectedDate, dateFilterMode, isExporting]);

  const exportDishesCsv = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);

    try {
      const headers = ["name", "category", "price", "totalOrdered", "totalQuantity", "totalRevenue", "averageRating"];

      const rows = dishAnalysis.dishes.map((dish) => ({
        name: dish.name,
        category: dish.category,
        price: formatPrice(dish.price),
        totalOrdered: dish.totalOrdered,
        totalQuantity: dish.totalQuantity,
        totalRevenue: formatPrice(dish.totalRevenue),
        averageRating: dish.averageRating !== null ? dish.averageRating.toFixed(2) : ""
      }));

      const csv = buildCsv(headers, rows);
      const filename = `plats_populaires_${formatPeriodLabel(selectedDate, dateFilterMode)}_${Date.now()}.csv`;

      downloadFile(csv, filename);
    } catch (error) {
      console.error("Dishes CSV export error:", error);
      setExportError("Impossible d'exporter les plats en CSV");
    } finally {
      setIsExporting(false);
    }
  }, [dishAnalysis.dishes, selectedDate, dateFilterMode, isExporting]);

  const exportPdf = useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);

    // Load dependencies dynamically
    const loadDependencies = async () => {
      try {
        const { default: jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        return { jsPDF, autoTable };
      } catch (error) {
        console.error('Error loading PDF dependencies:', error);
        throw new Error("Impossible de charger les dépendances PDF");
      }
    };

    try {
      const { jsPDF, autoTable } = await loadDependencies();

      const doc = new jsPDF({ 
        orientation: "landscape",
        unit: "pt", 
        format: "a4" 
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;

      // Title and summary
      const title = `Rapport ${formatPeriodLabel(selectedDate, dateFilterMode)}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(title, margin, 40);

      // Summary stats
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      const summaryText = [
        `Commandes: ${aggregates.count} | Payées: ${aggregates.paidCount} (${aggregates.paymentRate.toFixed(1)}%)`,
        `Chiffre d'affaires: ${formatPrice(aggregates.revenue)} FCFA`,
        `Frais de livraison: ${formatPrice(aggregates.deliveryFees)} FCFA | Sous-total: ${formatPrice(aggregates.subtotal)} FCFA`
      ];

      let yPosition = 65;
      summaryText.forEach((text) => {
        doc.text(text, margin, yPosition);
        yPosition += 15;
      });

      // Deliverers summary table
      if (aggregates.delivererArray.length > 0) {
        autoTable(doc, {
          startY: yPosition + 10,
          head: [["Livreur", "Commandes", "Payées", "Taux paiement", "CA", "Frais livraison", "Note moyenne"]],
          body: aggregates.delivererArray.map((deliverer) => [
            deliverer.name,
            String(deliverer.orders),
            String(deliverer.paid),
            `${deliverer.paymentRate.toFixed(1)}%`,
            `${formatPrice(deliverer.revenue)} FCFA`,
            `${formatPrice(deliverer.deliveryFees)} FCFA`,
            deliverer.avgRating !== null ? deliverer.avgRating.toFixed(2) : "—"
          ]),
          styles: { fontSize: 10, cellPadding: 5 },
          headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
          theme: "striped",
          margin: { left: margin, right: margin }
        });
      }

      // Orders detail table
      const currentY = doc.lastAutoTable?.finalY || yPosition + 50;
      if (currentY > 500) {
        doc.addPage();
        yPosition = 40;
      } else {
        yPosition = currentY + 30;
      }

if (filteredOrders.length > 0) {
        autoTable(doc, {
          startY: yPosition,
          head: [["Date", "ID", "Statut", "Payé", "Méthode", "Livreur", "Destination", "Total", "Note"]],
          body: filteredOrders.slice(0, 50).map((order) => [
            order.date ? order.date.toLocaleDateString("fr-FR") : "",
            order.id,
            order.status,
            order.isPaid ? "Oui" : "Non",
            order.paymentMethod,
            order.assignedDeliverer,
            order.destination,
            `${formatPrice(order.total)} FCFA`,
            order.rating !== null ? String(order.rating) : "—"
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 60 },
            2: { cellWidth: 60 },
            7: { cellWidth: 70 }
          },
          theme: "striped",
          margin: { left: margin, right: margin }
        });

        if (filteredOrders.length > 50) {
          const remainingY = doc.lastAutoTable.finalY + 10;
          doc.setFontSize(10);
          doc.text(`... et ${filteredOrders.length - 50} autres commandes (voir export CSV pour le détail complet)`, 
                  margin, remainingY);
        }
      }

      const filename = `rapport_${formatPeriodLabel(selectedDate, dateFilterMode)}_${Date.now()}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("PDF export error:", error);
      setExportError("Impossible d'exporter en PDF. Réessayez ou utilisez l'export CSV.");
    } finally {
      setIsExporting(false);
    }
  }, [aggregates, filteredOrders, selectedDate, dateFilterMode, isExporting]);

  // Render loading state
  if (isExporting) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filtres de période */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="text-xl mr-2">📅</span>
          Filtres de Période
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mode de filtrage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Période
            </label>
            <select
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="day">📅 Jour</option>
              <option value="week">📊 Semaine</option>
              <option value="month">🗓️ Mois</option>
              <option value="all">🔍 Toutes les périodes</option>
            </select>
          </div>

          {/* Sélecteur de date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de référence
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Boutons rapides */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Raccourcis
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                  setDateFilterMode('day');
                }}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSelectedDate(yesterday.toISOString().split('T')[0]);
                  setDateFilterMode('day');
                }}
                className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors font-bold"
              >
                📅 Hier
              </button>
              <button
                onClick={() => {
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                  setDateFilterMode('week');
                }}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              >
                Cette semaine
              </button>
              <button
                onClick={() => {
                  setSelectedDate(new Date().toISOString().split('T')[0]);
                  setDateFilterMode('month');
                }}
                className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
              >
                Ce mois
              </button>
              <button
                onClick={() => {
                  setDateFilterMode('all');
                }}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                🔍 Tout afficher
              </button>
            </div>
          </div>
        </div>

        {/* Résumé de la période sélectionnée */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Période actuelle :</strong> {formatPeriodLabel(selectedDate, dateFilterMode)}
            <span className="ml-4 text-gray-500">
              ({filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''} trouvée{filteredOrders.length > 1 ? 's' : ''})
            </span>
          </p>
          
        </div>
      </div>

      {/* Header with export controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Rapport {formatPeriodLabel(selectedDate, dateFilterMode)}
          </h2>
          <p className="text-gray-600 mt-1">
            Synthèse détaillée des commandes • {filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''}
            <span className="ml-2 text-xs text-green-600">
              🔄 Mise à jour automatique
            </span>
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setForceRefresh(prev => prev + 1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm shadow-sm"
          >
            🔄 Actualiser données
          </button>
          <button 
            onClick={exportOrdersCsv}
            disabled={isExporting || filteredOrders.length === 0}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            📊 Export commandes (CSV)
          </button>
          <button 
            onClick={exportDeliverersCsv}
            disabled={isExporting || aggregates.delivererArray.length === 0}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🚚 Export livreurs (CSV)
          </button>
          <button 
            onClick={exportDishesCsv}
            disabled={isExporting || dishAnalysis.dishes.length === 0}
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🍽️ Export plats (CSV)
          </button>
          <button 
            onClick={exportPdf}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Error display */}
      {exportError && (
        <ErrorDisplay 
          message={exportError} 
          onRetry={clearError}
        />
      )}

      {/* RAPPORT COMPLET DES COMMANDES - VUE D'ENSEMBLE */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center">
          <span className="text-2xl mr-2">📊</span>
          Rapport Complet des Commandes - Vue d'Ensemble
        </h3>

        {/* Statistiques principales en grille */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
            <div className="text-xs text-blue-600 uppercase tracking-wide">Commandes</div>
            <div className="text-2xl font-bold mt-1 text-blue-700">{aggregates.count}</div>
            <div className="text-xs text-blue-500">Total période</div>
          </div>

          <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
            <div className="text-xs text-green-600 uppercase tracking-wide">Payées</div>
            <div className="text-2xl font-bold mt-1 text-green-700">{aggregates.paidCount}</div>
            <div className="text-xs text-green-500">Paiements reçus</div>
          </div>

          <div className="bg-purple-50 rounded-xl p-4 border-l-4 border-purple-500">
            <div className="text-xs text-purple-600 uppercase tracking-wide">Taux paiement</div>
            <div className="text-2xl font-bold mt-1 text-purple-700">{aggregates.paymentRate.toFixed(1)}%</div>
            <div className="text-xs text-purple-500">Efficacité paiement</div>
          </div>

          <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-600">
            <div className="text-xs text-green-700 uppercase tracking-wide">Chiffre d'affaires</div>
            <div className="text-xl font-bold mt-1 text-green-800">{formatPrice(aggregates.revenue)} FCFA</div>
            <div className="text-xs text-green-600">💰 Revenus totaux</div>
          </div>

          <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
            <div className="text-xs text-orange-600 uppercase tracking-wide">Frais livraison</div>
            <div className="text-xl font-bold mt-1 text-orange-700">{formatPrice(aggregates.deliveryFees)} FCFA</div>
            <div className="text-xs text-orange-500">🚚 Coûts livraison</div>
          </div>

          <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
            <div className="text-xs text-indigo-600 uppercase tracking-wide">Sous-total</div>
            <div className="text-xl font-bold mt-1 text-indigo-700">{formatPrice(aggregates.subtotal)} FCFA</div>
            <div className="text-xs text-indigo-500">📈 Ventes produits</div>
          </div>
        </div>

        {/* Section détaillée en 2 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* PERFORMANCE PAR LIVREUR */}
          <div>
            <h4 className="text-md font-semibold mb-4 text-blue-700 flex items-center">
              🚚 Performance par Livreur
            </h4>
            <div className="space-y-3">
              {aggregates.delivererArray.map((deliverer, index) => (
                <div key={deliverer.name} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-400">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-medium text-gray-800">{deliverer.name}</h5>
                      <p className="text-sm text-gray-600">{deliverer.orders} commande{deliverer.orders > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">
                        {formatPrice(deliverer.revenue)} FCFA
                      </div>
                      <div className="text-xs text-gray-500">
                        {deliverer.paymentRate.toFixed(1)}% payé
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">Payées:</span> {deliverer.paid}/{deliverer.orders}
                    </div>
                    <div>
                      <span className="font-medium">Frais:</span> {formatPrice(deliverer.deliveryFees)} FCFA
                    </div>
                  </div>
                  {deliverer.avgRating && (
                    <div className="mt-2 text-xs text-yellow-600">
                      ⭐ Note moyenne: {deliverer.avgRating.toFixed(1)}/5
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ZONES DE LIVRAISON POPULAIRES */}
          <div>
            <h4 className="text-md font-semibold mb-4 text-green-700 flex items-center">
              📍 Zones de Livraison Populaires
            </h4>
            <div className="space-y-3">
              {(() => {
                // Calculer les statistiques par destination
                const destinationStats = {};
                filteredOrders.forEach(order => {
                  const dest = order.destination || 'Non spécifiée';
                  if (!destinationStats[dest]) {
                    destinationStats[dest] = { count: 0, revenue: 0, deliveryFees: 0 };
                  }
                  destinationStats[dest].count += 1;
                  destinationStats[dest].revenue += order.total;
                  destinationStats[dest].deliveryFees += order.deliveryFee;
                });

                return Object.entries(destinationStats)
                  .sort(([,a], [,b]) => b.count - a.count)
                  .map(([destination, stats]) => (
                    <div key={destination} className="bg-gray-50 p-4 rounded-lg border-l-4 border-green-400">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-medium text-gray-800">{destination}</h5>
                          <p className="text-sm text-gray-600">{stats.count} livraison{stats.count > 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {formatPrice(stats.revenue)} FCFA
                          </div>
                          <div className="text-xs text-gray-500">
                            {((stats.count / aggregates.count) * 100).toFixed(1)}% des commandes
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Frais moyens:</span> {formatPrice(stats.deliveryFees / stats.count)} FCFA
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* SOLDES DES COMPTES - AJOUTÉ AU RAPPORT DES COMMANDES */}
      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center">
          <span className="text-2xl mr-2">💰</span>
          Soldes Disponibles dans les Comptes
        </h3>
        
        {/* Calcul des soldes basé sur les données actuelles */}
        {(() => {
          // Calculer les soldes des comptes basé sur les commandes filtrées
          const accountBalances = {};
          
          filteredOrders.forEach(order => {
            // NE COMPTER QUE LES COMMANDES PAYÉES
            if (!order.isPaid) return;

            // Utiliser les données de paiement sauvegardées (order.payment) en priorité
            const paymentMethod = order.payment?.method;
            const paymentProvider = order.payment?.provider;

            // Vérifier d'abord si on a des données payment valides
            if (order.payment && typeof order.payment === 'object' && Object.keys(order.payment).length > 0) {

            if (paymentMethod === 'mobile_money') {
                if (paymentProvider === 'OM' || paymentProvider === 'Orange Money') {
                  accountBalances['Orange Money'] = (accountBalances['Orange Money'] || 0) + order.total;

                } else if (paymentProvider === 'MOMO' || paymentProvider === 'MTN') {
                  accountBalances['MTN Mobile Money'] = (accountBalances['MTN Mobile Money'] || 0) + order.total;

              } else {
                // Si pas de provider spécifique, utiliser fallback
                  accountBalances['Orange Money'] = (accountBalances['Orange Money'] || 0) + order.total;

              }
            } else if (paymentMethod === 'cash') {
              accountBalances.cash = (accountBalances.cash || 0) + order.total;

            } else if (paymentMethod === 'bank_transfer') {
              accountBalances.bank = (accountBalances.bank || 0) + order.total;

            } else if (paymentMethod === 'mixed') {
              // Pour les paiements mixtes, répartir selon les montants
              accountBalances.cash = (accountBalances.cash || 0) + (order.payment?.cashAmount || 0);
                if (paymentProvider === 'OM' || paymentProvider === 'Orange Money') {
                  accountBalances['Orange Money'] = (accountBalances['Orange Money'] || 0) + (order.payment?.mobileAmount || 0);

                } else if (paymentProvider === 'MOMO' || paymentProvider === 'MTN') {
                  accountBalances['MTN Mobile Money'] = (accountBalances['MTN Mobile Money'] || 0) + (order.payment?.mobileAmount || 0);

              }
            } else {
                // Si méthode inconnue mais on a des données payment, essayer de deviner

                accountBalances.cash = (accountBalances.cash || 0) + order.total;

              }
            } else {

              // Si pas de données payment, utiliser le fallback avec l'ancien format
              const oldPaymentMethod = order.paymentMethod;

              if (oldPaymentMethod && typeof oldPaymentMethod === 'object') {
                // Ancien format: { id: "mobile_money_om", name: "Orange Money" }
                const methodId = oldPaymentMethod.id || '';
                const methodName = oldPaymentMethod.name || '';
                
                if (methodId.includes('om') || methodName.includes('Orange')) {
                  accountBalances['Orange Money'] = (accountBalances['Orange Money'] || 0) + order.total;

                } else if (methodId.includes('momo') || methodId.includes('mtn') || methodName.includes('MTN')) {
                  accountBalances['MTN Mobile Money'] = (accountBalances['MTN Mobile Money'] || 0) + order.total;

                } else if (methodId.includes('cash') || methodName.includes('Cash')) {
                accountBalances.cash = (accountBalances.cash || 0) + order.total;

                } else if (methodId.includes('bank') || methodName.includes('Bank')) {
                accountBalances.bank = (accountBalances.bank || 0) + order.total;

              } else {
                // Par défaut, si on ne sait pas, mettre en cash
                accountBalances.cash = (accountBalances.cash || 0) + order.total;

                }
              } else if (typeof oldPaymentMethod === 'string') {
                // Ancien format: string simple
                if (oldPaymentMethod.includes('Mobile') || oldPaymentMethod.includes('Orange')) {
                  accountBalances['Orange Money'] = (accountBalances['Orange Money'] || 0) + order.total;

                } else if (oldPaymentMethod.includes('MTN')) {
                  accountBalances['MTN Mobile Money'] = (accountBalances['MTN Mobile Money'] || 0) + order.total;

                } else if (oldPaymentMethod.includes('Cash') || oldPaymentMethod.includes('Espèces')) {
                  accountBalances.cash = (accountBalances.cash || 0) + order.total;

                } else if (oldPaymentMethod.includes('Bank')) {
                  accountBalances.bank = (accountBalances.bank || 0) + order.total;

                } else {
                  // Par défaut, si on ne sait pas, mettre en cash
                  accountBalances.cash = (accountBalances.cash || 0) + order.total;

                }
              } else {
                // Par défaut, si on ne sait pas, mettre en cash
                accountBalances.cash = (accountBalances.cash || 0) + order.total;

              }
            }
          });

          // Les soldes représentent l'argent disponible dans chaque compte
          // Pas de déduction automatique des dépenses opérationnelles ici
          
          return (
            <div className="space-y-4">
              {/* DEBUG: Afficher les données de paiement */}
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-800 mb-2">
                  🔍 DEBUG - Données de paiement des commandes 
                  <span className="ml-2 text-xs text-green-600">(Mise à jour automatique)</span>
                </h4>
                <div className="text-xs text-yellow-700 space-y-1 max-h-40 overflow-y-auto">
                  {filteredOrders.filter(o => o.isPaid).slice(0, 5).map(order => {
                    const hasPayment = order.payment && Object.keys(order.payment).length > 0;
                    const paymentMethod = order.payment?.method || 'N/A';
                    const paymentProvider = order.payment?.provider || 'N/A';
                    
                    return (
                      <div key={order.id} className={`border-b border-yellow-200 pb-1 mb-1 ${hasPayment ? 'bg-green-50' : 'bg-red-50'}`}>
                        <div className="font-bold">{order.id.slice(-8)}</div>
                        <div>Payment: {hasPayment ? JSON.stringify(order.payment) : 'AUCUN'}</div>
                        <div>PaymentMethod: {JSON.stringify(order.paymentMethod)}</div>
                        <div>isPaid: {order.isPaid ? 'OUI' : 'NON'}</div>
                        {hasPayment && (
                          <div className="text-green-700 font-medium">
                            → {paymentMethod} ({paymentProvider})
                    </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-yellow-600">
                  <strong>Soldes calculés:</strong> {JSON.stringify(accountBalances)}
                </div>
                <div className="mt-1 text-xs text-blue-600">
                  <strong>Dernière mise à jour:</strong> {new Date().toLocaleTimeString()}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(accountBalances).map(([account, balance]) => {
                const getAccountLabel = (acc, bal) => {
                  const formattedBalance = Math.abs(bal).toLocaleString();
                  const sign = bal >= 0 ? '+' : '-';
                  switch (acc) {
                    case 'cash': return `💵 ${sign}${formattedBalance} FCFA Espèces`;
                    case 'Orange Money': return `🟠 ${sign}${formattedBalance} FCFA Orange Money`;
                    case 'MTN Mobile Money': return `🟡 ${sign}${formattedBalance} FCFA MTN Mobile Money`;
                    case 'bank': return `🏦 ${sign}${formattedBalance} FCFA Virement Bancaire`;
                    default: return `${sign}${formattedBalance} FCFA ${acc}`;
                  }
                };

                const getBalanceColor = (bal) => {
                  return bal >= 0 ? 'text-green-600' : 'text-red-600';
                };

                const getAccountStyle = (acc) => {
                  switch (acc) {
                    case 'cash': return 'bg-green-50 border-l-green-500';
                    case 'Orange Money': return 'bg-orange-50 border-l-orange-500';
                    case 'MTN Mobile Money': return 'bg-yellow-50 border-l-yellow-500';
                    case 'bank': return 'bg-blue-50 border-l-blue-500';
                    default: return 'bg-gray-50 border-l-gray-500';
                  }
                };

                const getAccountIcon = (acc) => {
                  switch (acc) {
                    case 'cash': return '💵';
                    case 'Orange Money': return '🟠';
                    case 'MTN Mobile Money': return '🟡';
                    case 'bank': return '🏦';
                    default: return '💰';
                  }
                };

                return (
                  <div key={account} className={`rounded-lg p-4 border-l-4 ${getAccountStyle(account)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getAccountIcon(account)}</span>
                        <div>
                          <div className="font-medium text-sm text-gray-800">{account}</div>
                          <div className="text-xs text-gray-600">
                            {account === 'cash' && 'Paiements en espèces'}
                            {account === 'Orange Money' && 'Paiements Orange Money'}
                            {account === 'MTN Mobile Money' && 'Paiements MTN Mobile Money'}
                            {account === 'bank' && 'Virements bancaires'}
                    </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getBalanceColor(balance)}`}>
                          {balance >= 0 ? '+' : ''}{balance.toLocaleString()} FCFA
                        </div>
                        <div className="text-xs text-gray-500">
                      {balance >= 0 ? 'Solde positif' : 'Solde négatif'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Si aucun compte n'a de solde, afficher un message */}
              {Object.keys(accountBalances).length === 0 && (
                <div className="col-span-full bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="text-red-800 font-medium">❌ Aucun solde détecté</div>
                  <div className="text-red-600 text-sm mt-1">
                    Vérifiez que des commandes sont marquées comme payées et ont une méthode de paiement.
                  </div>
                </div>
              )}
              </div>
            </div>
          );
        })()}
        
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="text-blue-600 text-xl">ℹ️</div>
            <div>
              <h4 className="font-semibold text-blue-800 mb-2">Informations sur les soldes des comptes</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>• Orange Money (🟠):</strong> Paiements reçus via Orange Money</p>
                <p><strong>• MTN Mobile Money (🟡):</strong> Paiements reçus via MTN Mobile Money</p>
                <p><strong>• Espèces (💵):</strong> Paiements reçus en espèces</p>
                <p><strong>• Virement Bancaire (🏦):</strong> Paiements reçus par virement</p>
                <p className="mt-2 text-xs text-blue-600">
                  <strong>Note:</strong> Soldes calculés sur la période sélectionnée. Représentent l'argent effectivement disponible dans chaque compte (paiements reçus uniquement).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

ReportsDashboard.displayName = 'ReportsDashboard';

export default React.memo(ReportsDashboard);