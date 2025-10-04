import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FaBroom,
  FaChartPie,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSpinner,
  FaDownload,
  FaEye,
  FaTrash,
  FaSync
} from 'react-icons/fa';
import { 
  cleanupAndClassifyAllExpenses, 
  detectDuplicates, 
  generateConsistencyReport,
  CLASSIFICATION_SYSTEM 
} from '../../utils/expenseCleanup';
import { formatPrice } from '../../utils/adminUtils';

const ExpenseCleanupManager = ({ currentRestaurantId, userRole }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [consistencyReport, setConsistencyReport] = useState(null);
  const [activeTab, setActiveTab] = useState('cleanup');

  // Charger le rapport de cohérence au montage
  useEffect(() => {
    loadConsistencyReport();
  }, []);

  const loadConsistencyReport = async () => {
    try {
      const report = await generateConsistencyReport();
      setConsistencyReport(report);
    } catch (error) {
      console.error('Erreur lors du chargement du rapport:', error);
    }
  };

  const runCleanup = async () => {
    try {
      setIsRunning(true);
      const cleanupResults = await cleanupAndClassifyAllExpenses();
      setResults(cleanupResults);
      
      // Recharger le rapport après nettoyage
      await loadConsistencyReport();
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const loadDuplicates = async () => {
    try {
      const duplicateList = await detectDuplicates();
      setDuplicates(duplicateList);
    } catch (error) {
      console.error('Erreur lors de la détection des doublons:', error);
    }
  };

  const exportReport = () => {
    if (!consistencyReport) return;
    
    let csvContent = "Type,Description,Montant,Département,Catégorie,Source,Date\n";
    
    // Ajouter les statistiques par département
    csvContent += "\n=== STATISTIQUES PAR DÉPARTEMENT ===\n";
    csvContent += "Département,Nombre de dépenses,Montant total\n";
    Object.entries(consistencyReport.byDepartment).forEach(([dept, stats]) => {
      csvContent += `${dept},${stats.count},${stats.total}\n`;
    });
    
    // Ajouter les statistiques par catégorie
    csvContent += "\n=== STATISTIQUES PAR CATÉGORIE ===\n";
    csvContent += "Catégorie,Nombre de dépenses,Montant total\n";
    Object.entries(consistencyReport.byCategory).forEach(([cat, stats]) => {
      csvContent += `${cat},${stats.count},${stats.total}\n`;
    });
    
    // Télécharger le fichier
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'rapport_coherence_depenses.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = [
    { id: 'cleanup', label: '🧹 Nettoyage', icon: FaBroom },
    { id: 'duplicates', label: '🔍 Doublons', icon: FaExclamationTriangle },
    { id: 'report', label: '📊 Rapport', icon: FaChartPie }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🧹 Gestion des Sorties</h2>
          <p className="text-gray-600">Nettoyage et classification cohérente de toutes les dépenses</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadConsistencyReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <FaSync className="mr-2" />
            Actualiser
          </button>
          <button
            onClick={exportReport}
            disabled={!consistencyReport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center disabled:opacity-50"
          >
            <FaDownload className="mr-2" />
            Exporter
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="mt-6">
        {activeTab === 'cleanup' && (
          <div className="space-y-6">
            {/* Système de classification */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">📋 Système de Classification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(CLASSIFICATION_SYSTEM.DEPARTMENTS).map(([key, dept]) => (
                  <div key={key} className="border rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-2xl">{dept.icon}</span>
                      <div>
                        <h4 className="font-medium" style={{ color: dept.color }}>
                          {dept.label}
                        </h4>
                        <p className="text-xs text-gray-500">{dept.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bouton de nettoyage */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">🚀 Nettoyage Automatique</h3>
              <p className="text-gray-600 mb-4">
                Cette opération va classifier automatiquement toutes les dépenses selon le système cohérent défini.
              </p>
              <button
                onClick={runCleanup}
                disabled={isRunning}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {isRunning ? (
                  <FaSpinner className="mr-2 animate-spin" />
                ) : (
                  <FaBroom className="mr-2" />
                )}
                {isRunning ? 'Nettoyage en cours...' : 'Lancer le nettoyage'}
              </button>
            </div>

            {/* Résultats du nettoyage */}
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <h3 className="text-lg font-semibold mb-4">✅ Résultats du Nettoyage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-800">Dépenses Générales</h4>
                    <p className="text-2xl font-bold text-green-600">{results.expenses.updated}</p>
                    <p className="text-sm text-green-600">mises à jour sur {results.expenses.processed}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800">Achats</h4>
                    <p className="text-2xl font-bold text-blue-600">{results.purchases.updated}</p>
                    <p className="text-sm text-blue-600">mises à jour sur {results.purchases.processed}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h4 className="font-medium text-purple-800">Livraison</h4>
                    <p className="text-2xl font-bold text-purple-600">{results.deliveryExpenses.updated}</p>
                    <p className="text-sm text-purple-600">mises à jour sur {results.deliveryExpenses.processed}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <h4 className="font-medium text-orange-800">Achats Cuisine</h4>
                    <p className="text-2xl font-bold text-orange-600">{results.purchaseLists.updated}</p>
                    <p className="text-sm text-orange-600">mises à jour sur {results.purchaseLists.processed}</p>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-4">
                    <h4 className="font-medium text-teal-800">Ingrédients</h4>
                    <p className="text-2xl font-bold text-teal-600">{results.ingredients.updated}</p>
                    <p className="text-sm text-teal-600">mises à jour sur {results.ingredients.processed}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {activeTab === 'duplicates' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">🔍 Détection des Doublons</h3>
                <button
                  onClick={loadDuplicates}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center"
                >
                  <FaEye className="mr-2" />
                  Analyser
                </button>
              </div>
              
              {duplicates.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-orange-600 font-medium">
                    {duplicates.length} doublons potentiels détectés
                  </p>
                  <div className="space-y-2">
                    {duplicates.slice(0, 10).map((dup, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-orange-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{dup.original.description}</p>
                            <p className="text-sm text-gray-600">
                              {formatPrice(dup.original.amount || dup.original.total || 0)} FCFA - 
                              {new Date(dup.original.createdAt).toLocaleDateString('fr-FR')}
                            </p>
                            <p className="text-xs text-gray-500">
                              Source: {dup.original.source} | Doublon: {dup.duplicate.source}
                            </p>
                          </div>
                          <span className="px-2 py-1 bg-orange-200 text-orange-800 text-xs rounded-full">
                            {dup.similarity}
                          </span>
                        </div>
                      </div>
                    ))}
                    {duplicates.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... et {duplicates.length - 10} autres doublons
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Aucun doublon détecté. Cliquez sur "Analyser" pour vérifier.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6">
            {consistencyReport ? (
              <>
                {/* Vue d'ensemble */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h4 className="font-medium text-gray-600">Total Dépenses</h4>
                    <p className="text-2xl font-bold text-gray-900">{consistencyReport.totalExpenses}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h4 className="font-medium text-gray-600">Non Classifiés</h4>
                    <p className="text-2xl font-bold text-orange-600">{consistencyReport.unclassified}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h4 className="font-medium text-gray-600">À Réviser</h4>
                    <p className="text-2xl font-bold text-red-600">{consistencyReport.needsReview}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h4 className="font-medium text-gray-600">Doublons</h4>
                    <p className="text-2xl font-bold text-purple-600">{consistencyReport.duplicates}</p>
                  </div>
                </div>

                {/* Par département */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">📊 Répartition par Département</h3>
                  <div className="space-y-3">
                    {Object.entries(consistencyReport.byDepartment).map(([dept, stats]) => (
                      <div key={dept} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">
                            {CLASSIFICATION_SYSTEM.DEPARTMENTS[dept]?.icon || '📦'}
                          </span>
                          <div>
                            <p className="font-medium">
                              {CLASSIFICATION_SYSTEM.DEPARTMENTS[dept]?.label || dept}
                            </p>
                            <p className="text-sm text-gray-500">{stats.count} dépenses</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatPrice(stats.total)} FCFA</p>
                          <p className="text-sm text-gray-500">
                            {((stats.total / Object.values(consistencyReport.byDepartment).reduce((sum, s) => sum + s.total, 0)) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Par catégorie */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">📊 Répartition par Catégorie</h3>
                  <div className="space-y-3">
                    {Object.entries(consistencyReport.byCategory).map(([cat, stats]) => (
                      <div key={cat} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">
                            {CLASSIFICATION_SYSTEM.CATEGORIES[cat]?.icon || '📋'}
                          </span>
                          <div>
                            <p className="font-medium">
                              {CLASSIFICATION_SYSTEM.CATEGORIES[cat]?.label || cat}
                            </p>
                            <p className="text-sm text-gray-500">{stats.count} dépenses</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatPrice(stats.total)} FCFA</p>
                          <p className="text-sm text-gray-500">
                            {((stats.total / Object.values(consistencyReport.byCategory).reduce((sum, s) => sum + s.total, 0)) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Par source */}
                {consistencyReport.bySource && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4">📊 Répartition par Source</h3>
                    <div className="space-y-3">
                      {Object.entries(consistencyReport.bySource).map(([source, stats]) => (
                        <div key={source} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">
                              {source === 'expenses' ? '🧾' :
                               source === 'purchases' ? '🛒' :
                               source === 'deliveryExpenses' ? '🚚' :
                               source === 'purchaseLists' ? '🛍️' :
                               source === 'ingredients' ? '🥬' : '📋'}
                            </span>
                            <div>
                              <p className="font-medium">
                                {source === 'expenses' ? 'Dépenses Générales' :
                                 source === 'purchases' ? 'Achats' :
                                 source === 'deliveryExpenses' ? 'Livraison' :
                                 source === 'purchaseLists' ? 'Achats Cuisine' :
                                 source === 'ingredients' ? 'Ingrédients' : source}
                              </p>
                              <p className="text-sm text-gray-500">{stats.count} dépenses</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{formatPrice(stats.total)} FCFA</p>
                            <p className="text-sm text-gray-500">
                              {((stats.total / Object.values(consistencyReport.bySource).reduce((sum, s) => sum + s.total, 0)) * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <FaSpinner className="mx-auto text-4xl text-gray-400 mb-4 animate-spin" />
                <p className="text-gray-500">Chargement du rapport...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseCleanupManager;
