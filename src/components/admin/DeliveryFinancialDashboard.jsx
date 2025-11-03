import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import {
  FaChartLine,
  FaMoneyBillWave,
  FaArrowUp,
  FaArrowDown,
  FaFileExport,
  FaFilePdf,
  FaFileExcel,
  FaCalendarWeek,
  FaTruck,
  FaGasPump,
  FaWrench,
  FaChartBar,
  FaUser,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DeliveryFinancialDashboard = ({ currentRestaurantId }) => {
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [deliverers, setDeliverers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState('day'); // 'day', 'week', 'month', 'custom'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [commissionRate, setCommissionRate] = useState(20); // Pourcentage de commission

  useEffect(() => {
    if (!currentRestaurantId) return;
    loadData();
  }, [currentRestaurantId, periodType, selectedDate, startDate, endDate]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Déterminer la période
      let startPeriod, endPeriod;
      if (periodType === 'custom' && startDate && endDate) {
        startPeriod = new Date(startDate);
        endPeriod = new Date(endDate);
        endPeriod.setHours(23, 59, 59, 999);
      } else {
        const date = new Date(selectedDate);
        if (periodType === 'day') {
          startPeriod = new Date(date);
          startPeriod.setHours(0, 0, 0, 0);
          endPeriod = new Date(date);
          endPeriod.setHours(23, 59, 59, 999);
        } else if (periodType === 'week') {
          const dayOfWeek = date.getDay();
          startPeriod = new Date(date);
          startPeriod.setDate(date.getDate() - dayOfWeek);
          startPeriod.setHours(0, 0, 0, 0);
          endPeriod = new Date(startPeriod);
          endPeriod.setDate(startPeriod.getDate() + 6);
          endPeriod.setHours(23, 59, 59, 999);
        } else if (periodType === 'month') {
          startPeriod = new Date(date.getFullYear(), date.getMonth(), 1);
          endPeriod = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        }
      }

      // Charger les commandes restaurant livrées
      const ordersQuery = query(
        collection(db, 'orders'),
        where('restaurantId', '==', currentRestaurantId),
        where('status', 'in', ['livree', 'delivered'])
      );
      const ordersSnap = await getDocs(ordersQuery);
      const ordersData = ordersSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data(), source: 'restaurant' }))
        .filter((order) => {
          const orderDate = order.deliveryCompletedAt?.toDate() || order.updatedAt?.toDate();
          return orderDate && orderDate >= startPeriod && orderDate <= endPeriod;
        })
        .filter(
          (order) =>
            order.assignedDeliverer &&
            order.assignedDeliverer !== 'Non assigné' &&
            order.assignedDeliverer.trim() !== ''
        );

      // Charger les commandes partenaires livrées
      const partnerOrdersQuery = query(
        collection(db, 'partnerOrders'),
        where('restaurantId', '==', currentRestaurantId),
        where('status', '==', 'delivered')
      );
      const partnerOrdersSnap = await getDocs(partnerOrdersQuery);
      const partnerOrdersData = partnerOrdersSnap.docs
        .map((doc) => ({ 
          id: doc.id, 
          ...doc.data(), 
          source: 'partner',
          // Normaliser les champs pour compatibilité
          deliveryFee: doc.data().deliveryFee || 0,
        }))
        .filter((order) => {
          const orderDate = order.updatedAt?.toDate() || order.createdAt?.toDate();
          return orderDate && orderDate >= startPeriod && orderDate <= endPeriod;
        })
        .filter(
          (order) =>
            order.assignedDeliverer &&
            order.assignedDeliverer !== 'Non assigné' &&
            order.assignedDeliverer.trim() !== ''
        );

      // Combiner les deux types de commandes
      const allOrders = [...ordersData, ...partnerOrdersData];
      setOrders(allOrders);

      // Charger les dépenses
      const expensesQuery = query(
        collection(db, 'deliveryExpenses'),
        where('restaurantId', '==', currentRestaurantId)
      );
      const expensesSnap = await getDocs(expensesQuery);
      const expensesData = expensesSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((expense) => {
          const expenseDate = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
          return expenseDate >= startPeriod && expenseDate <= endPeriod;
        });
      setExpenses(expensesData);

      // Charger les livreurs
      const deliverersSnap = await getDocs(
        query(collection(db, 'deliverers'), where('restaurantId', '==', currentRestaurantId))
      );
      const deliverersData = deliverersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDeliverers(deliverersData);

      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
      setLoading(false);
    }
  };

  // Calculs financiers
  const financialData = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const commission = (totalRevenue * commissionRate) / 100;
    const netProfit = totalRevenue - totalExpenses - commission;

    // Répartition par source (restaurant vs partenaires)
    const restaurantOrders = orders.filter((o) => o.source === 'restaurant');
    const partnerOrders = orders.filter((o) => o.source === 'partner');
    const restaurantRevenue = restaurantOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    const partnerRevenue = partnerOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

    // Dépenses par catégorie
    const expensesByCategory = {
      fuel: expenses.filter((e) => e.category === 'fuel' || e.type === 'fuel').reduce((sum, e) => sum + e.amount, 0),
      maintenance: expenses
        .filter((e) => e.category === 'maintenance' || e.type === 'maintenance')
        .reduce((sum, e) => sum + e.amount, 0),
      repair: expenses.filter((e) => e.category === 'repair').reduce((sum, e) => sum + e.amount, 0),
      other: expenses.filter((e) => e.category === 'other' || e.type === 'other' || e.type === 'salary').reduce((sum, e) => sum + e.amount, 0),
    };

    // Performance par livreur
    const delivererPerformance = deliverers.map((deliverer) => {
      const delivererOrders = orders.filter((o) => o.assignedDeliverer === deliverer.name);
      const delivererExpenses = expenses.filter((e) => e.delivererId === deliverer.id);
      const revenue = delivererOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
      const expensesTotal = delivererExpenses.reduce((sum, e) => sum + e.amount, 0);
      const delivererCommission = (revenue * commissionRate) / 100;
      const profit = revenue - expensesTotal - delivererCommission;

      return {
        id: deliverer.id,
        name: deliverer.name,
        deliveries: delivererOrders.length,
        revenue,
        expenses: expensesTotal,
        commission: delivererCommission,
        profit,
        avgDeliveryTime:
          delivererOrders.length > 0
            ? Math.round(
                delivererOrders.reduce((sum, o) => sum + (o.deliveryDurationMinutes || 0), 0) /
                  delivererOrders.length
              )
            : 0,
      };
    });

    return {
      totalRevenue,
      totalExpenses,
      commission,
      netProfit,
      totalDeliveries: orders.length,
      restaurantOrders: restaurantOrders.length,
      partnerOrders: partnerOrders.length,
      restaurantRevenue,
      partnerRevenue,
      expensesByCategory,
      delivererPerformance: delivererPerformance.sort((a, b) => b.profit - a.profit),
    };
  }, [orders, expenses, deliverers, commissionRate]);

  // Export CSV
  const exportToCSV = () => {
    try {
      // En-tête du rapport
      let csv = `Rapport Financier Livraisons\n`;
      csv += `Periode: ${getPeriodLabel()}\n`;
      csv += `Date d'export: ${new Date().toLocaleString('fr-FR')}\n\n`;

      // Résumé financier
      csv += `RESUME FINANCIER\n`;
      csv += `Revenus totaux,${financialData.totalRevenue}\n`;
      csv += `Depenses totales,${financialData.totalExpenses}\n`;
      csv += `Commission (${commissionRate}%),${financialData.commission}\n`;
      csv += `Benefice net,${financialData.netProfit}\n`;
      csv += `Nombre de livraisons,${financialData.totalDeliveries}\n\n`;

      // Répartition par source
      csv += `REPARTITION PAR SOURCE\n`;
      csv += `Commandes Restaurant,${financialData.restaurantOrders},${financialData.restaurantRevenue} FCFA\n`;
      csv += `Commandes Partenaires,${financialData.partnerOrders},${financialData.partnerRevenue} FCFA\n\n`;

      // Dépenses par catégorie
      csv += `DEPENSES PAR CATEGORIE\n`;
      csv += `Carburant,${financialData.expensesByCategory.fuel}\n`;
      csv += `Entretien,${financialData.expensesByCategory.maintenance}\n`;
      csv += `Reparations,${financialData.expensesByCategory.repair}\n`;
      csv += `Divers,${financialData.expensesByCategory.other}\n\n`;

      // Performance par livreur
      csv += `PERFORMANCE PAR LIVREUR\n`;
      csv += `Livreur,Livraisons,Revenus,Depenses,Commission,Benefice,Temps moyen\n`;
      financialData.delivererPerformance.forEach((d) => {
        csv += `${d.name},${d.deliveries},${d.revenue},${d.expenses},${d.commission},${d.profit},${d.avgDeliveryTime} min\n`;
      });

      // Ajouter BOM UTF-8 pour Excel
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csv;

      // Télécharger le fichier avec encodage UTF-8
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `rapport_livraisons_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success('Rapport exporte avec succes');
    } catch (error) {
      console.error('Erreur export:', error);
      toast.error('Erreur lors de l\'export');
    }
  };

  // Export PDF (via impression)
  const exportToPDF = () => {
    window.print();
    toast.info('Utilisez la fonction d\'impression pour générer le PDF');
  };

  const getPeriodLabel = () => {
    if (periodType === 'custom' && startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString('fr-FR')} - ${new Date(endDate).toLocaleDateString('fr-FR')}`;
    }
    const date = new Date(selectedDate);
    if (periodType === 'day') {
      return date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } else if (periodType === 'week') {
      return `Semaine du ${date.toLocaleDateString('fr-FR')}`;
    } else if (periodType === 'month') {
      return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header avec contrôles */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <FaChartLine className="mr-3 text-blue-600" />
            Tableau de Bord Financier - Livraisons
          </h3>
          <div className="flex flex-wrap gap-3">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Jour</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="custom">Personnalisé</option>
            </select>
            {periodType !== 'custom' ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Date début"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Date fin"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </>
            )}
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center"
            >
              <FaFileExcel className="mr-2" />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center"
            >
              <FaFilePdf className="mr-2" />
              PDF
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Taux de commission :</label>
          <input
            type="number"
            value={commissionRate}
            onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
            className="w-20 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">%</span>
        </div>
      </div>

      {/* Période affichée */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <p className="text-blue-800 font-medium flex items-center">
          <FaCalendarWeek className="mr-2" />
          Période : {getPeriodLabel()}
        </p>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-green-600">
                {financialData.totalRevenue.toLocaleString()} FCFA
              </p>
              <p className="text-xs text-gray-500 mt-1">{financialData.totalDeliveries} livraisons</p>
            </div>
            <FaMoneyBillWave className="text-4xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Dépenses</p>
              <p className="text-2xl font-bold text-red-600">
                {financialData.totalExpenses.toLocaleString()} FCFA
              </p>
              <p className="text-xs text-gray-500 mt-1">{expenses.length} dépenses</p>
            </div>
            <FaArrowDown className="text-4xl text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Commission ({commissionRate}%)</p>
              <p className="text-2xl font-bold text-orange-600">
                {financialData.commission.toLocaleString()} FCFA
              </p>
            </div>
            <FaTruck className="text-4xl text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Bénéfice Net</p>
              <p
                className={`text-2xl font-bold ${
                  financialData.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}
              >
                {financialData.netProfit.toLocaleString()} FCFA
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {financialData.netProfit >= 0 ? 'Bénéficiaire' : 'Déficitaire'}
              </p>
            </div>
            {financialData.netProfit >= 0 ? (
              <FaArrowUp className="text-4xl text-blue-500" />
            ) : (
              <FaArrowDown className="text-4xl text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* Répartition Restaurant vs Partenaires */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <FaTruck className="mr-2 text-blue-600" />
          Répartition par Source
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-semibold text-blue-900">🍽️ Commandes Restaurant</h5>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700">Nombre de livraisons</span>
                <span className="text-xl font-bold text-blue-900">{financialData.restaurantOrders}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700">Revenus</span>
                <span className="text-xl font-bold text-blue-900">
                  {financialData.restaurantRevenue.toLocaleString()} FCFA
                </span>
              </div>
              <div className="pt-2 border-t border-blue-300">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-blue-600">Part du total</span>
                  <span className="text-sm font-semibold text-blue-800">
                    {financialData.totalRevenue > 0
                      ? ((financialData.restaurantRevenue / financialData.totalRevenue) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-semibold text-green-900">🤝 Commandes Partenaires</h5>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700">Nombre de livraisons</span>
                <span className="text-xl font-bold text-green-900">{financialData.partnerOrders}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700">Revenus</span>
                <span className="text-xl font-bold text-green-900">
                  {financialData.partnerRevenue.toLocaleString()} FCFA
                </span>
              </div>
              <div className="pt-2 border-t border-green-300">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-green-600">Part du total</span>
                  <span className="text-sm font-semibold text-green-800">
                    {financialData.totalRevenue > 0
                      ? ((financialData.partnerRevenue / financialData.totalRevenue) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dépenses par catégorie */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <FaChartBar className="mr-2 text-purple-600" />
          Répartition des Dépenses
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">Carburant</p>
                <p className="text-xl font-bold text-orange-900">
                  {financialData.expensesByCategory.fuel.toLocaleString()} FCFA
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  {financialData.totalExpenses > 0
                    ? ((financialData.expensesByCategory.fuel / financialData.totalExpenses) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <FaGasPump className="text-3xl text-orange-600" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Entretien</p>
                <p className="text-xl font-bold text-blue-900">
                  {financialData.expensesByCategory.maintenance.toLocaleString()} FCFA
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {financialData.totalExpenses > 0
                    ? ((financialData.expensesByCategory.maintenance / financialData.totalExpenses) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <FaWrench className="text-3xl text-blue-600" />
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Réparations</p>
                <p className="text-xl font-bold text-red-900">
                  {financialData.expensesByCategory.repair.toLocaleString()} FCFA
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {financialData.totalExpenses > 0
                    ? ((financialData.expensesByCategory.repair / financialData.totalExpenses) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <FaWrench className="text-3xl text-red-600" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Divers</p>
                <p className="text-xl font-bold text-purple-900">
                  {financialData.expensesByCategory.other.toLocaleString()} FCFA
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  {financialData.totalExpenses > 0
                    ? ((financialData.expensesByCategory.other / financialData.totalExpenses) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <FaFileExport className="text-3xl text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Performance par livreur */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h4 className="font-semibold text-gray-800 flex items-center">
            <FaUser className="mr-2 text-blue-600" />
            Performance Individuelle des Livreurs
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Livreur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Livraisons</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenus</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dépenses</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Commission ({commissionRate}%)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bénéfice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Temps Moy.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {financialData.delivererPerformance.map((deliverer) => (
                <tr key={deliverer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <FaUser className="text-blue-600 text-sm" />
                      </div>
                      <span className="ml-3 text-sm font-medium text-gray-900">{deliverer.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{deliverer.deliveries}</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600">
                    {deliverer.revenue.toLocaleString()} FCFA
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600">
                    {deliverer.expenses.toLocaleString()} FCFA
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-orange-600">
                    {deliverer.commission.toLocaleString()} FCFA
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-sm font-bold ${
                        deliverer.profit >= 0 ? 'text-blue-600' : 'text-red-600'
                      }`}
                    >
                      {deliverer.profit.toLocaleString()} FCFA
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{deliverer.avgDeliveryTime} min</td>
                </tr>
              ))}
            </tbody>
          </table>
          {financialData.delivererPerformance.length === 0 && (
            <div className="text-center py-8">
              <FaUser className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">Aucune donnée disponible pour cette période</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryFinancialDashboard;
