import React, { useMemo } from 'react';
import {
  FaChartLine,
  FaArrowUp,
  FaArrowDown,
  FaEquals
} from 'react-icons/fa';

const ManagerPerformanceChart = ({ managers, dateRange }) => {
  // Calcul des tendances par gérant
  const performanceData = useMemo(() => {
    return managers.map(manager => {
      const profitMargin = manager.financial.margin;
      const profit = manager.financial.profit;
      const efficiency = manager.orders.count > 0 ? manager.financial.revenue / manager.orders.count : 0;
      
      // Déterminer la tendance basée sur la marge
      let trend = 'stable';
      let trendColor = 'text-gray-500';
      let trendIcon = FaEquals;
      
      if (profitMargin >= 20) {
        trend = 'excellent';
        trendColor = 'text-green-600';
        trendIcon = FaArrowUp;
      } else if (profitMargin >= 10) {
        trend = 'good';
        trendColor = 'text-blue-600';
        trendIcon = FaArrowUp;
      } else if (profitMargin >= 0) {
        trend = 'warning';
        trendColor = 'text-yellow-600';
        trendIcon = FaEquals;
      } else {
        trend = 'critical';
        trendColor = 'text-red-600';
        trendIcon = FaArrowDown;
      }

      return {
        ...manager,
        profitMargin,
        profit,
        efficiency,
        trend,
        trendColor,
        trendIcon
      };
    }).sort((a, b) => b.profitMargin - a.profitMargin);
  }, [managers]);

  // Statistiques de performance
  const performanceStats = useMemo(() => {
    const total = performanceData.length;
    const excellent = performanceData.filter(m => m.trend === 'excellent').length;
    const good = performanceData.filter(m => m.trend === 'good').length;
    const warning = performanceData.filter(m => m.trend === 'warning').length;
    const critical = performanceData.filter(m => m.trend === 'critical').length;

    return {
      total,
      excellent,
      good,
      warning,
      critical,
      excellentPercent: total > 0 ? (excellent / total) * 100 : 0,
      goodPercent: total > 0 ? (good / total) * 100 : 0,
      warningPercent: total > 0 ? (warning / total) * 100 : 0,
      criticalPercent: total > 0 ? (critical / total) * 100 : 0
    };
  }, [performanceData]);

  if (performanceData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FaChartLine className="mr-2 text-blue-600" />
          Analyse de Performance
        </h3>
        <p className="text-gray-500 text-center py-8">Aucune donnée disponible pour la période sélectionnée</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
        <FaChartLine className="mr-2 text-blue-600" />
        Analyse de Performance
      </h3>

      {/* Répartition des performances */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-2">
            <span className="text-2xl font-bold text-green-600">{performanceStats.excellent}</span>
          </div>
          <p className="text-sm font-medium text-gray-700">Excellents</p>
          <p className="text-xs text-gray-500">≥ 20% marge</p>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-2">
            <span className="text-2xl font-bold text-blue-600">{performanceStats.good}</span>
          </div>
          <p className="text-sm font-medium text-gray-700">Bons</p>
          <p className="text-xs text-gray-500">10-20% marge</p>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-2">
            <span className="text-2xl font-bold text-yellow-600">{performanceStats.warning}</span>
          </div>
          <p className="text-sm font-medium text-gray-700">À surveiller</p>
          <p className="text-xs text-gray-500">0-10% marge</p>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-2">
            <span className="text-2xl font-bold text-red-600">{performanceStats.critical}</span>
          </div>
          <p className="text-sm font-medium text-gray-700">Critiques</p>
          <p className="text-xs text-gray-500">Déficitaires</p>
        </div>
      </div>

      {/* Barre de progression globale */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Répartition des performances</span>
          <span>{performanceStats.total} gérants</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div className="h-full flex">
            {performanceStats.excellentPercent > 0 && (
              <div 
                className="bg-green-500 h-full"
                style={{ width: `${performanceStats.excellentPercent}%` }}
                title={`${performanceStats.excellent} excellents (${performanceStats.excellentPercent.toFixed(1)}%)`}
              />
            )}
            {performanceStats.goodPercent > 0 && (
              <div 
                className="bg-blue-500 h-full"
                style={{ width: `${performanceStats.goodPercent}%` }}
                title={`${performanceStats.good} bons (${performanceStats.goodPercent.toFixed(1)}%)`}
              />
            )}
            {performanceStats.warningPercent > 0 && (
              <div 
                className="bg-yellow-500 h-full"
                style={{ width: `${performanceStats.warningPercent}%` }}
                title={`${performanceStats.warning} à surveiller (${performanceStats.warningPercent.toFixed(1)}%)`}
              />
            )}
            {performanceStats.criticalPercent > 0 && (
              <div 
                className="bg-red-500 h-full"
                style={{ width: `${performanceStats.criticalPercent}%` }}
                title={`${performanceStats.critical} critiques (${performanceStats.criticalPercent.toFixed(1)}%)`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Classement des gérants */}
      <div>
        <h4 className="font-medium text-gray-800 mb-4">Classement par Performance</h4>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {performanceData.map((manager, index) => {
            const TrendIcon = manager.trendIcon;
            return (
              <div key={manager.manager.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                    index === 1 ? 'bg-gray-100 text-gray-800' :
                    index === 2 ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{manager.manager.name}</p>
                    <p className="text-sm text-gray-600">{manager.restaurant?.name}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${
                      manager.profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {manager.profit.toLocaleString()} FCFA
                    </p>
                    <p className="text-xs text-gray-500">
                      {manager.profitMargin.toFixed(1)}% marge
                    </p>
                  </div>
                  
                  <TrendIcon className={`text-lg ${manager.trendColor}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommandations */}
      {(performanceStats.warning > 0 || performanceStats.critical > 0) && (
        <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">💡 Recommandations</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {performanceStats.critical > 0 && (
              <li>• {performanceStats.critical} gérant{performanceStats.critical > 1 ? 's' : ''} en déficit nécessite{performanceStats.critical === 1 ? '' : 'nt'} une intervention urgente</li>
            )}
            {performanceStats.warning > 0 && (
              <li>• {performanceStats.warning} gérant{performanceStats.warning > 1 ? 's' : ''} avec marge faible à surveiller de près</li>
            )}
            <li>• Analyser les coûts et optimiser les dépenses des gérants en difficulté</li>
            <li>• Partager les bonnes pratiques des gérants performants</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ManagerPerformanceChart;
