import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import {
  FaReceipt,
  FaChartPie,
  FaMoneyBillWave,
  FaFilter,
  FaSearch,
  FaDownload,
  FaEdit,
  FaTrash,
  FaPlus,
  FaCheckCircle,
  FaExclamationTriangle
} from 'react-icons/fa';
import { formatPrice } from '../../utils/adminUtils';

const ExpenseClassificationSystem = ({ currentRestaurantId, userRole }) => {
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [deliveryExpenses, setDeliveryExpenses] = useState([]);
  const [purchaseLists, setPurchaseLists] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Système de classification cohérent
  const CLASSIFICATION_SYSTEM = {
    DEPARTMENTS: {
      'magedabord': {
        label: '🍽️ Maged\'Abord',
        description: 'Restaurant principal - Plats traditionnels',
        color: '#EF4444',
        icon: '🍽️'
      },
      'crunch': {
        label: '🥪 Crunch',
        description: 'Restaurant secondaire - Snacks et boissons',
        color: '#F59E0B',
        icon: '🥪'
      },
      'square': {
        label: '🏪 Square',
        description: 'Service de livraison et logistique',
        color: '#8B5CF6',
        icon: '🏪'
      },
      'divers': {
        label: '📦 Divers',
        description: 'Dépenses générales et administratives',
        color: '#6B7280',
        icon: '📦'
      }
    },
    CATEGORIES: {
      'ingredients': {
        label: '🥬 Ingrédients',
        description: 'Achats d\'ingrédients et matières premières',
        departments: ['magedabord', 'crunch']
      },
      'equipment': {
        label: '🔧 Équipement',
        description: 'Achat et maintenance d\'équipements',
        departments: ['magedabord', 'crunch', 'square']
      },
      'utilities': {
        label: '⚡ Services publics',
        description: 'Électricité, eau, gaz, internet',
        departments: ['magedabord', 'crunch', 'divers']
      },
      'delivery': {
        label: '🚚 Livraison',
        description: 'Carburant, entretien véhicules, frais de livraison',
        departments: ['square']
      },
      'staff': {
        label: '👥 Personnel',
        description: 'Salaires, primes, formations',
        departments: ['magedabord', 'crunch', 'square']
      },
      'marketing': {
        label: '📢 Marketing',
        description: 'Publicité, promotions, communication',
        departments: ['magedabord', 'crunch', 'divers']
      },
      'rent': {
        label: '🏠 Loyer',
        description: 'Loyers des locaux',
        departments: ['magedabord', 'crunch', 'square']
      },
      'insurance': {
        label: '🛡️ Assurances',
        description: 'Assurances diverses',
        departments: ['magedabord', 'crunch', 'square', 'divers']
      },
      'other': {
        label: '📋 Autres',
        description: 'Dépenses diverses non classées',
        departments: ['divers']
      }
    }
  };

  // Charger toutes les données de sorties
  useEffect(() => {
    const loadAllExpenses = async () => {
      try {
        setLoading(true);
        
        // Charger les dépenses générales
        const expensesQuery = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
        const expensesSnapshot = await getDocs(expensesQuery);
        const expensesData = expensesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'expense',
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        setExpenses(expensesData);

        // Charger les achats
        const purchasesQuery = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
        const purchasesSnapshot = await getDocs(purchasesQuery);
        const purchasesData = purchasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'purchase',
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        setPurchases(purchasesData);

        // Charger les dépenses de livraison
        const deliveryQuery = query(collection(db, 'deliveryExpenses'), orderBy('createdAt', 'desc'));
        const deliverySnapshot = await getDocs(deliveryQuery);
        const deliveryData = deliverySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'delivery',
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        setDeliveryExpenses(deliveryData);

        // Charger les listes d'achats de cuisine
        const purchaseListsQuery = query(collection(db, 'purchaseLists'), orderBy('date', 'desc'));
        const purchaseListsSnapshot = await getDocs(purchaseListsQuery);
        const purchaseListsData = purchaseListsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'purchaseList',
          description: `Liste d'achat cuisine - ${doc.data().brands?.join(', ') || 'Divers'}`,
          amount: doc.data().total || 0,
          createdAt: doc.data().date ? new Date(doc.data().date) : new Date()
        }));
        setPurchaseLists(purchaseListsData);

        // Charger les coûts des ingrédients
        const ingredientsQuery = query(collection(db, 'ingredients'), orderBy('name'));
        const ingredientsSnapshot = await getDocs(ingredientsQuery);
        const ingredientsData = ingredientsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'ingredient',
          description: `Ingrédient: ${doc.data().name}`,
          amount: doc.data().unitPrice || 0,
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }));
        setIngredients(ingredientsData);

      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAllExpenses();
  }, []);

  // Classifier automatiquement les dépenses
  const classifiedExpenses = useMemo(() => {
    const allExpenses = [...expenses, ...purchases, ...deliveryExpenses, ...purchaseLists, ...ingredients];
    
    return allExpenses.map(expense => {
      // Classification automatique basée sur les données existantes
      let department = 'divers';
      let category = 'other';
      
      // Classification par type de dépense
      if (expense.type === 'delivery') {
        department = 'square';
        category = 'delivery';
      } else if (expense.type === 'purchase') {
        // Analyser la description pour déterminer le département
        const description = (expense.description || '').toLowerCase();
        if (description.includes('ingrédient') || description.includes('aliment') || description.includes('viande') || description.includes('poisson')) {
          department = 'magedabord';
          category = 'ingredients';
        } else if (description.includes('snack') || description.includes('boisson') || description.includes('jus')) {
          department = 'crunch';
          category = 'ingredients';
        } else if (description.includes('équipement') || description.includes('machine') || description.includes('cuisine')) {
          department = 'magedabord';
          category = 'equipment';
        } else {
          department = 'divers';
          category = 'other';
        }
      } else if (expense.type === 'expense') {
        // Utiliser le département existant ou classifier automatiquement
        const existingDept = expense.department?.toLowerCase();
        if (existingDept && CLASSIFICATION_SYSTEM.DEPARTMENTS[existingDept]) {
          department = existingDept;
        } else {
          // Classification automatique basée sur la description
          const description = (expense.description || '').toLowerCase();
          if (description.includes('livraison') || description.includes('carburant') || description.includes('véhicule')) {
            department = 'square';
            category = 'delivery';
          } else if (description.includes('salair') || description.includes('personnel') || description.includes('employé')) {
            department = 'magedabord';
            category = 'staff';
          } else if (description.includes('loyer') || description.includes('location')) {
            department = 'magedabord';
            category = 'rent';
          } else if (description.includes('électricité') || description.includes('eau') || description.includes('gaz')) {
            department = 'magedabord';
            category = 'utilities';
          } else {
            department = 'divers';
            category = 'other';
          }
        }
      }

      return {
        ...expense,
        classifiedDepartment: department,
        classifiedCategory: category,
        needsReview: !expense.classifiedDepartment || !expense.classifiedCategory
      };
    });
  }, [expenses, purchases, deliveryExpenses]);

  // Filtrer les dépenses selon la période et le département
  const filteredExpenses = useMemo(() => {
    let filtered = classifiedExpenses;

    // Filtre par période
    if (selectedPeriod !== 'all') {
      const now = new Date();
      let startDate, endDate;

      switch (selectedPeriod) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          return filtered;
      }

      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.createdAt);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    }

    // Filtre par département
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(expense => expense.classifiedDepartment === selectedDepartment);
    }

    return filtered;
  }, [classifiedExpenses, selectedPeriod, selectedDepartment]);

  // Calculer les statistiques par département
  const departmentStats = useMemo(() => {
    const stats = {};
    
    Object.keys(CLASSIFICATION_SYSTEM.DEPARTMENTS).forEach(dept => {
      stats[dept] = {
        total: 0,
        count: 0,
        categories: {},
        needsReview: 0
      };
    });

    filteredExpenses.forEach(expense => {
      const dept = expense.classifiedDepartment;
      const amount = Number(expense.amount || expense.total || 0);
      
      if (stats[dept]) {
        stats[dept].total += amount;
        stats[dept].count += 1;
        
        if (expense.needsReview) {
          stats[dept].needsReview += 1;
        }
        
        const category = expense.classifiedCategory;
        if (!stats[dept].categories[category]) {
          stats[dept].categories[category] = 0;
        }
        stats[dept].categories[category] += amount;
      }
    });

    return stats;
  }, [filteredExpenses]);

  // Mettre à jour la classification d'une dépense
  const updateExpenseClassification = async (expenseId, department, category) => {
    try {
      // Trouver la dépense et son type
      const expense = classifiedExpenses.find(e => e.id === expenseId);
      if (!expense) return;

      let collectionName = 'expenses';
      if (expense.type === 'delivery') collectionName = 'deliveryExpenses';
      else if (expense.type === 'purchase') collectionName = 'purchases';
      else if (expense.type === 'purchaseList') collectionName = 'purchaseLists';
      else if (expense.type === 'ingredient') collectionName = 'ingredients';
      
      const expenseRef = doc(db, collectionName, expenseId);
      await updateDoc(expenseRef, {
        classifiedDepartment: department,
        classifiedCategory: category,
        updatedAt: new Date()
      });

      // Mettre à jour l'état local
      setExpenses(prev => prev.map(e => 
        e.id === expenseId ? { ...e, classifiedDepartment: department, classifiedCategory: category, needsReview: false } : e
      ));
      setPurchases(prev => prev.map(p => 
        p.id === expenseId ? { ...p, classifiedDepartment: department, classifiedCategory: category, needsReview: false } : p
      ));
      setDeliveryExpenses(prev => prev.map(d => 
        d.id === expenseId ? { ...d, classifiedDepartment: department, classifiedCategory: category, needsReview: false } : d
      ));
      setPurchaseLists(prev => prev.map(pl => 
        pl.id === expenseId ? { ...pl, classifiedDepartment: department, classifiedCategory: category, needsReview: false } : pl
      ));
      setIngredients(prev => prev.map(i => 
        i.id === expenseId ? { ...i, classifiedDepartment: department, classifiedCategory: category, needsReview: false } : i
      ));

    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    }
  };

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
          <h2 className="text-2xl font-bold text-gray-900">💰 Classification des Sorties</h2>
          <p className="text-gray-600">Organisation cohérente de toutes les dépenses par département</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              const csvContent = generateCSV(filteredExpenses);
              downloadCSV(csvContent, 'classification_depenses.csv');
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
          >
            <FaDownload className="mr-2" />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">🔍 Filtres</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Période</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="all">Toutes les périodes</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">30 derniers jours</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="all">Tous les départements</option>
              {Object.entries(CLASSIFICATION_SYSTEM.DEPARTMENTS).map(([key, dept]) => (
                <option key={key} value={key}>{dept.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Statistiques par département */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(CLASSIFICATION_SYSTEM.DEPARTMENTS).map(([key, dept]) => {
          const stats = departmentStats[key] || { total: 0, count: 0, needsReview: 0 };
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-sm p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{dept.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-600">{dept.label}</p>
                      <p className="text-xs text-gray-500">{dept.description}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2" style={{ color: dept.color }}>
                    {formatPrice(stats.total)} FCFA
                  </p>
                  <p className="text-sm text-gray-500">{stats.count} dépenses</p>
                  {stats.needsReview > 0 && (
                    <p className="text-xs text-orange-600 flex items-center mt-1">
                      <FaExclamationTriangle className="mr-1" />
                      {stats.needsReview} à réviser
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Détail des dépenses */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">📋 Dépenses Classifiées ({filteredExpenses.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Département</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">
                        {expense.type === 'delivery' ? '🚚' : 
                         expense.type === 'purchase' ? '🛒' : 
                         expense.type === 'purchaseList' ? '🛍️' :
                         expense.type === 'ingredient' ? '🥬' : '🧾'}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{expense.description}</div>
                        <div className="text-sm text-gray-500">{expense.supplier || expense.supplierName || 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {formatPrice(expense.amount || expense.total || 0)} FCFA
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="px-2 py-1 text-xs font-medium rounded-full text-white"
                      style={{ backgroundColor: CLASSIFICATION_SYSTEM.DEPARTMENTS[expense.classifiedDepartment]?.color || '#6B7280' }}
                    >
                      {CLASSIFICATION_SYSTEM.DEPARTMENTS[expense.classifiedDepartment]?.icon} {CLASSIFICATION_SYSTEM.DEPARTMENTS[expense.classifiedDepartment]?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {CLASSIFICATION_SYSTEM.CATEGORIES[expense.classifiedCategory]?.label || 'Non classé'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(expense.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedExpense(expense);
                          setShowClassificationModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <FaEdit />
                      </button>
                      {expense.needsReview && (
                        <span className="text-orange-500 text-sm">
                          <FaExclamationTriangle />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de classification */}
      {showClassificationModal && selectedExpense && (
        <ClassificationModal
          expense={selectedExpense}
          classificationSystem={CLASSIFICATION_SYSTEM}
          onUpdate={updateExpenseClassification}
          onClose={() => {
            setShowClassificationModal(false);
            setSelectedExpense(null);
          }}
        />
      )}
    </div>
  );
};

// Composant modal pour modifier la classification
const ClassificationModal = ({ expense, classificationSystem, onUpdate, onClose }) => {
  const [selectedDepartment, setSelectedDepartment] = useState(expense.classifiedDepartment);
  const [selectedCategory, setSelectedCategory] = useState(expense.classifiedCategory);

  const handleSave = () => {
    onUpdate(expense.id, selectedDepartment, selectedCategory);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Modifier la Classification</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              {Object.entries(classificationSystem.DEPARTMENTS).map(([key, dept]) => (
                <option key={key} value={key}>{dept.icon} {dept.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            >
              {Object.entries(classificationSystem.CATEGORIES).map(([key, cat]) => (
                <option key={key} value={key}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
};

// Fonctions utilitaires
const generateCSV = (expenses) => {
  let csvContent = "Type,Description,Montant,Département,Catégorie,Date,Fournisseur\n";
  
  expenses.forEach(expense => {
    csvContent += `${expense.type},${expense.description || ''},${expense.amount || expense.total || 0},${expense.classifiedDepartment},${expense.classifiedCategory},${new Date(expense.createdAt).toLocaleDateString('fr-FR')},${expense.supplier || expense.supplierName || ''}\n`;
  });
  
  return csvContent;
};

const downloadCSV = (content, filename) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default ExpenseClassificationSystem;
