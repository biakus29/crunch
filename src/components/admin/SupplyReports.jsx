import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import {
  FaChartLine,
  FaCalendarAlt,
  FaDownload,
  FaExchangeAlt,
  FaPrint,
  FaFileExcel,
  FaTrophy,
  FaArrowDown
} from 'react-icons/fa';

const SupplyReports = ({ currentRestaurantId }) => {
  const [purchaseLists, setPurchaseLists] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('period'); // 'period' or 'comparison'
  
  const [periodFilter, setPeriodFilter] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [comparisonFilter, setComparisonFilter] = useState({
    period1Start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0],
    period1End: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0],
    period2Start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    period2End: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      const [purchasesSnap, ingredientsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'purchaseLists'),
          where('restaurantId', '==', currentRestaurantId),
          where('status', '==', 'approved'),
          orderBy('date', 'desc')
        )),
        getDocs(query(
          collection(db, 'ingredients'),
          where('restaurantId', '==', currentRestaurantId)
        ))
      ]);

      setPurchaseLists(purchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIngredients(ingredientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setLoading(false);
    }
  };

  const filterPurchasesByPeriod = (startDate, endDate) => {
    return purchaseLists.filter(purchase => {
      const purchaseDate = new Date(purchase.date);
      return purchaseDate >= new Date(startDate) && purchaseDate <= new Date(endDate);
    });
  };

  const calculatePeriodStats = (purchases) => {
    const totalSpent = purchases.reduce((sum, purchase) => sum + (purchase.total || 0), 0);
    
    // Ingrédients par quantité
    const ingredientStats = {};
    purchases.forEach(purchase => {
      purchase.items?.forEach(item => {
        if (!ingredientStats[item.ingredientId]) {
          ingredientStats[item.ingredientId] = {
            name: item.name,
            totalQuantity: 0,
            totalSpent: 0,
            purchases: 0
          };
        }
        ingredientStats[item.ingredientId].totalQuantity += item.quantity;
        ingredientStats[item.ingredientId].totalSpent += item.total;
        ingredientStats[item.ingredientId].purchases += 1;
      });
    });

    const sortedIngredients = Object.values(ingredientStats).sort((a, b) => b.totalQuantity - a.totalQuantity);
    const mostUsed = sortedIngredients[0];
    const leastUsed = sortedIngredients[sortedIngredients.length - 1];

    // Menus qui utilisent le plus d'ingrédients
    const menuIngredientCount = {};
    ingredients.forEach(ingredient => {
      ingredient.menus?.forEach(menuId => {
        if (!menuIngredientCount[menuId]) {
          menuIngredientCount[menuId] = 0;
        }
        menuIngredientCount[menuId] += 1;
      });
    });

    return {
      totalSpent,
      totalPurchases: purchases.length,
      ingredientStats: sortedIngredients,
      mostUsedIngredient: mostUsed,
      leastUsedIngredient: leastUsed,
      averagePurchaseAmount: purchases.length > 0 ? totalSpent / purchases.length : 0
    };
  };

  const generatePeriodReport = () => {
    const purchases = filterPurchasesByPeriod(periodFilter.startDate, periodFilter.endDate);
    return calculatePeriodStats(purchases);
  };

  const generateComparisonReport = () => {
    const period1Purchases = filterPurchasesByPeriod(comparisonFilter.period1Start, comparisonFilter.period1End);
    const period2Purchases = filterPurchasesByPeriod(comparisonFilter.period2Start, comparisonFilter.period2End);
    
    const period1Stats = calculatePeriodStats(period1Purchases);
    const period2Stats = calculatePeriodStats(period2Purchases);

    return {
      period1: period1Stats,
      period2: period2Stats,
      comparison: {
        spentDifference: period2Stats.totalSpent - period1Stats.totalSpent,
        spentPercentage: period1Stats.totalSpent > 0 ? 
          ((period2Stats.totalSpent - period1Stats.totalSpent) / period1Stats.totalSpent) * 100 : 0,
        purchasesDifference: period2Stats.totalPurchases - period1Stats.totalPurchases
      }
    };
  };

  const exportToCSV = (data, filename) => {
    let csvContent = '';
    
    if (reportType === 'period') {
      csvContent = [
        ['Rapport de Période', `${periodFilter.startDate} - ${periodFilter.endDate}`],
        [''],
        ['Résumé'],
        ['Total dépensé', `${data.totalSpent.toLocaleString()} FCFA`],
        ['Nombre d\'achats', data.totalPurchases],
        ['Montant moyen par achat', `${data.averagePurchaseAmount.toLocaleString()} FCFA`],
        [''],
        ['Ingrédients les plus utilisés'],
        ['Nom', 'Quantité totale', 'Montant dépensé', 'Nombre d\'achats'],
        ...data.ingredientStats.slice(0, 10).map(ing => [
          ing.name,
          ing.totalQuantity,
          `${ing.totalSpent.toLocaleString()} FCFA`,
          ing.purchases
        ])
      ].map(row => row.join(',')).join('\n');
    } else {
      csvContent = [
        ['Rapport de Comparaison'],
        [`Période 1: ${comparisonFilter.period1Start} - ${comparisonFilter.period1End}`],
        [`Période 2: ${comparisonFilter.period2Start} - ${comparisonFilter.period2End}`],
        [''],
        ['Métrique', 'Période 1', 'Période 2', 'Différence', 'Évolution %'],
        ['Total dépensé', 
         `${data.period1.totalSpent.toLocaleString()} FCFA`,
         `${data.period2.totalSpent.toLocaleString()} FCFA`,
         `${data.comparison.spentDifference.toLocaleString()} FCFA`,
         `${data.comparison.spentPercentage.toFixed(1)}%`
        ],
        ['Nombre d\'achats',
         data.period1.totalPurchases,
         data.period2.totalPurchases,
         data.comparison.purchasesDifference,
         ''
        ]
      ].map(row => row.join(',')).join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-6 text-center">Chargement...</div>;
  }

  const periodReport = reportType === 'period' ? generatePeriodReport() : null;
  const comparisonReport = reportType === 'comparison' ? generateComparisonReport() : null;

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="flex flex-col justify-between items-start gap-2 sm:flex-row sm:items-center">
        <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">Rapports d'Achats</h3>
        <div className="flex w-full gap-1 sm:w-auto sm:gap-2">
          <button
            onClick={() => setReportType('period')}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition duration-200 sm:flex-none sm:px-4 sm:py-2 sm:text-sm ${
              reportType === 'period' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <FaCalendarAlt className="inline mr-2" />
            Période
          </button>
          <button
            onClick={() => setReportType('comparison')}
            className={`px-4 py-2 rounded-lg ${
              reportType === 'comparison' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            <FaExchangeAlt className="inline mr-2" />
            Comparaison
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4">
        {reportType === 'period' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date début</label>
              <input
                type="date"
                value={periodFilter.startDate}
                onChange={(e) => setPeriodFilter({...periodFilter, startDate: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date fin</label>
              <input
                type="date"
                value={periodFilter.endDate}
                onChange={(e) => setPeriodFilter({...periodFilter, endDate: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Période 1</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={comparisonFilter.period1Start}
                  onChange={(e) => setComparisonFilter({...comparisonFilter, period1Start: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={comparisonFilter.period1End}
                  onChange={(e) => setComparisonFilter({...comparisonFilter, period1End: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Période 2</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={comparisonFilter.period2Start}
                  onChange={(e) => setComparisonFilter({...comparisonFilter, period2Start: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={comparisonFilter.period2End}
                  onChange={(e) => setComparisonFilter({...comparisonFilter, period2End: e.target.value})}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <button
          onClick={() => exportToCSV(
            reportType === 'period' ? periodReport : comparisonReport,
            `rapport-achats-${reportType}-${new Date().toISOString().split('T')[0]}.csv`
          )}
          className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2"
        >
          <FaFileExcel /> Exporter CSV
        </button>
        <button
          onClick={printReport}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2"
        >
          <FaPrint /> Imprimer
        </button>
      </div>

      {/* Rapport de période */}
      {reportType === 'period' && periodReport && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-semibold text-gray-700">Total Dépensé</h4>
              <p className="text-2xl font-bold text-blue-600">
                {periodReport.totalSpent.toLocaleString()} FCFA
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-semibold text-gray-700">Nombre d'Achats</h4>
              <p className="text-2xl font-bold text-green-600">
                {periodReport.totalPurchases}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-semibold text-gray-700">Montant Moyen</h4>
              <p className="text-2xl font-bold text-orange-600">
                {periodReport.averagePurchaseAmount.toLocaleString()} FCFA
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-semibold text-gray-700">Ingrédients Différents</h4>
              <p className="text-2xl font-bold text-purple-600">
                {periodReport.ingredientStats.length}
              </p>
            </div>
          </div>

          {/* Top ingrédients */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <FaTrophy className="text-yellow-500" />
                Ingrédient le Plus Utilisé
              </h4>
              {periodReport.mostUsedIngredient && (
                <div className="text-center">
                  <p className="text-lg font-semibold">{periodReport.mostUsedIngredient.name}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {periodReport.mostUsedIngredient.totalQuantity} unités
                  </p>
                  <p className="text-sm text-gray-600">
                    {periodReport.mostUsedIngredient.totalSpent.toLocaleString()} FCFA dépensés
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <FaArrowDown className="text-red-500" />
                Ingrédient le Moins Utilisé
              </h4>
              {periodReport.leastUsedIngredient && (
                <div className="text-center">
                  <p className="text-lg font-semibold">{periodReport.leastUsedIngredient.name}</p>
                  <p className="text-2xl font-bold text-red-600">
                    {periodReport.leastUsedIngredient.totalQuantity} unités
                  </p>
                  <p className="text-sm text-gray-600">
                    {periodReport.leastUsedIngredient.totalSpent.toLocaleString()} FCFA dépensés
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tableau détaillé */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h4 className="font-semibold">Détail par Ingrédient</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Ingrédient</th>
                    <th className="px-4 py-2 text-left">Quantité Totale</th>
                    <th className="px-4 py-2 text-left">Montant Dépensé</th>
                    <th className="px-4 py-2 text-left">Nb Achats</th>
                    <th className="px-4 py-2 text-left">Prix Moyen</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {periodReport.ingredientStats.map((ingredient, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 font-medium">{ingredient.name}</td>
                      <td className="px-4 py-2">{ingredient.totalQuantity}</td>
                      <td className="px-4 py-2 font-semibold">
                        {ingredient.totalSpent.toLocaleString()} FCFA
                      </td>
                      <td className="px-4 py-2">{ingredient.purchases}</td>
                      <td className="px-4 py-2">
                        {(ingredient.totalSpent / ingredient.totalQuantity).toLocaleString()} FCFA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Rapport de comparaison */}
      {reportType === 'comparison' && comparisonReport && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Comparaison globale */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="font-semibold mb-4">Comparaison Globale</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <h5 className="font-medium text-gray-700 mb-2">Total Dépensé</h5>
                <div className="space-y-1">
                  <p className="text-lg">
                    Période 1: <span className="font-semibold">{comparisonReport.period1.totalSpent.toLocaleString()} FCFA</span>
                  </p>
                  <p className="text-lg">
                    Période 2: <span className="font-semibold">{comparisonReport.period2.totalSpent.toLocaleString()} FCFA</span>
                  </p>
                  <p className={`text-xl font-bold ${
                    comparisonReport.comparison.spentDifference >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {comparisonReport.comparison.spentDifference >= 0 ? '+' : ''}
                    {comparisonReport.comparison.spentDifference.toLocaleString()} FCFA
                    ({comparisonReport.comparison.spentPercentage.toFixed(1)}%)
                  </p>
                </div>
              </div>

              <div className="text-center">
                <h5 className="font-medium text-gray-700 mb-2">Nombre d'Achats</h5>
                <div className="space-y-1">
                  <p className="text-lg">
                    Période 1: <span className="font-semibold">{comparisonReport.period1.totalPurchases}</span>
                  </p>
                  <p className="text-lg">
                    Période 2: <span className="font-semibold">{comparisonReport.period2.totalPurchases}</span>
                  </p>
                  <p className={`text-xl font-bold ${
                    comparisonReport.comparison.purchasesDifference >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}>
                    {comparisonReport.comparison.purchasesDifference >= 0 ? '+' : ''}
                    {comparisonReport.comparison.purchasesDifference}
                  </p>
                </div>
              </div>

              <div className="text-center">
                <h5 className="font-medium text-gray-700 mb-2">Montant Moyen</h5>
                <div className="space-y-1">
                  <p className="text-lg">
                    Période 1: <span className="font-semibold">{comparisonReport.period1.averagePurchaseAmount.toLocaleString()} FCFA</span>
                  </p>
                  <p className="text-lg">
                    Période 2: <span className="font-semibold">{comparisonReport.period2.averagePurchaseAmount.toLocaleString()} FCFA</span>
                  </p>
                  <p className={`text-xl font-bold ${
                    (comparisonReport.period2.averagePurchaseAmount - comparisonReport.period1.averagePurchaseAmount) >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {(comparisonReport.period2.averagePurchaseAmount - comparisonReport.period1.averagePurchaseAmount) >= 0 ? '+' : ''}
                    {(comparisonReport.period2.averagePurchaseAmount - comparisonReport.period1.averagePurchaseAmount).toLocaleString()} FCFA
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SupplyReports;
