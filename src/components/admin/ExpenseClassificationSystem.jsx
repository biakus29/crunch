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
  FaExclamationTriangle,
  FaTruck,
  FaUtensils
} from 'react-icons/fa';
import { formatPrice } from '../../utils/adminUtils';

const ExpenseClassificationSystem = ({ currentRestaurantId, userRole }) => {
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [deliveryExpenses, setDeliveryExpenses] = useState([]);
  const [purchaseLists, setPurchaseLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsCategory, setDetailsCategory] = useState(null);
  const [detailsExpenses, setDetailsExpenses] = useState([]);

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
      'maintenance': {
        label: '🔨 Maintenance',
        description: 'Réparations et entretien des locaux',
        departments: ['magedabord', 'crunch', 'square']
      },
      'cleaning': {
        label: '🧹 Nettoyage',
        description: 'Produits et services de nettoyage',
        departments: ['magedabord', 'crunch', 'square']
      },
      'security': {
        label: '🔒 Sécurité',
        description: 'Services de sécurité et surveillance',
        departments: ['magedabord', 'crunch', 'square']
      },
      'banking': {
        label: '🏦 Frais bancaires',
        description: 'Frais de compte, virements, cartes',
        departments: ['divers']
      },
      'legal': {
        label: '⚖️ Légal',
        description: 'Honoraires d\'avocat, frais juridiques',
        departments: ['divers']
      },
      'accounting': {
        label: '📊 Comptabilité',
        description: 'Services comptables, logiciels',
        departments: ['divers']
      },
      'technology': {
        label: '💻 Technologie',
        description: 'Logiciels, matériel informatique, licences',
        departments: ['magedabord', 'crunch', 'square', 'divers']
      },
      'training': {
        label: '🎓 Formation',
        description: 'Formations du personnel, certifications',
        departments: ['magedabord', 'crunch', 'square']
      },
      'supplies': {
        label: '📦 Fournitures',
        description: 'Fournitures de bureau, emballages',
        departments: ['magedabord', 'crunch', 'square', 'divers']
      },
      'transport': {
        label: '🚗 Transport',
        description: 'Frais de transport, essence, parking',
        departments: ['square', 'divers']
      },
      'communication': {
        label: '📞 Communication',
        description: 'Téléphone, internet, abonnements',
        departments: ['magedabord', 'crunch', 'square', 'divers']
      },
      'waste': {
        label: '🗑️ Gestion des déchets',
        description: 'Collecte des déchets, recyclage',
        departments: ['magedabord', 'crunch']
      },
      'permits': {
        label: '📋 Permis et licences',
        description: 'Licences commerciales, permis sanitaires',
        departments: ['magedabord', 'crunch', 'divers']
      },
      'other': {
        label: '📋 Autres',
        description: 'Dépenses diverses non classées',
        departments: ['divers']
      }
    }
  };

  // Fonction centralisée de classification intelligente
  const classifyExpenseByContent = (text) => {
    const lowerText = text.toLowerCase();

    // Mots-clés étendus pour Maged'Abord (plats traditionnels)
    const magedabordKeywords = {
      high: ['eru', 'oko', 'okok', 'koki', 'ndole', 'kati-kati', 'bassa', 'poulet braisé', 'poulet pané'],
      medium: ['viande', 'poisson', 'poulet', 'bœuf', 'porc', 'agneau', 'légumes', 'tomate', 'oignon', 'ail', 'gingembre', 'piment', 'huile', 'sel', 'épices', 'bouillon', 'sauce', 'marinade', 'riz', 'haricot', 'pomme de terre', 'banane plantain', 'farine', 'céréales'],
      low: ['cuisine', 'restaurant', 'traditionnel', 'africain', 'magedabord']
    };

    // Mots-clés étendus pour Crunch (snacks et boissons)
    const crunchKeywords = {
      high: ['sandwich', 'burger', 'frites', 'pizza', 'tacos', 'wrap', 'poulet braisé', 'poulet pané'],
      medium: ['boisson', 'jus', 'soda', 'eau', 'café', 'thé', 'smoothie', 'snack', 'chips', 'biscuits', 'gâteau', 'dessert', 'glace', 'pain', 'baguette', 'croissant', 'viennoiserie', 'hamburger', 'hot-dog', 'nuggets'],
      low: ['fast-food', 'snacks', 'boissons', 'crunch', 'rapide']
    };

    // Calculer les scores
    let magedabordScore = 0;
    let crunchScore = 0;

    // Maged'Abord scoring
    magedabordScore += magedabordKeywords.high.filter(k => lowerText.includes(k)).length * 3;
    magedabordScore += magedabordKeywords.medium.filter(k => lowerText.includes(k)).length * 2;
    magedabordScore += magedabordKeywords.low.filter(k => lowerText.includes(k)).length * 1;

    // Crunch scoring
    crunchScore += crunchKeywords.high.filter(k => lowerText.includes(k)).length * 3;
    crunchScore += crunchKeywords.medium.filter(k => lowerText.includes(k)).length * 2;
    crunchScore += crunchKeywords.low.filter(k => lowerText.includes(k)).length * 1;

    // Déterminer le département avec seuil minimum
    const threshold = 1; // Au moins un mot-clé de poids 1 ou équivalent
    if (magedabordScore >= threshold && magedabordScore > crunchScore) {
      return 'magedabord';
    } else if (crunchScore >= threshold && crunchScore > magedabordScore) {
      return 'crunch';
    } else if (magedabordScore >= threshold && crunchScore >= threshold) {
      // En cas d'égalité, privilégier Maged'Abord pour les achats mixtes
      return 'magedabord';
    }

    return null; // Non classifiable automatiquement
  };

  // Charger toutes les données de sorties
  useEffect(() => {
    const loadAllExpenses = async () => {
      try {
        setLoading(true);
        console.log('🔄 Début du chargement des données de classification...');
        
        // Charger toutes les sources de données en parallèle
        const [
          expensesSnapshot,
          purchasesSnapshot,
          deliverySnapshot,
          purchaseListsSnapshot,
          budgetsSnapshot,
          ordersSnapshot
        ] = await Promise.all([
          // Dépenses générales
          getDocs(query(collection(db, 'expenses'), orderBy('createdAt', 'desc'))).catch(err => {
            console.warn('⚠️ Erreur chargement expenses:', err);
            return { docs: [] };
          }),
          // Achats
          getDocs(query(collection(db, 'purchases'), orderBy('createdAt', 'desc'))).catch(err => {
            console.warn('⚠️ Erreur chargement purchases:', err);
            return { docs: [] };
          }),
          // Dépenses de livraison
          getDocs(query(collection(db, 'deliveryExpenses'), orderBy('createdAt', 'desc'))).catch(err => {
            console.warn('⚠️ Erreur chargement deliveryExpenses:', err);
            return { docs: [] };
          }),
          // Listes d'achats de cuisine
          getDocs(query(collection(db, 'purchaseLists'), orderBy('date', 'desc'))).catch(err => {
            console.warn('⚠️ Erreur chargement purchaseLists:', err);
            return { docs: [] };
          }),
          // Budgets (considérés comme des sorties)
          getDocs(query(collection(db, 'budgets'), orderBy('createdAt', 'desc'))).catch(err => {
            console.warn('⚠️ Erreur chargement budgets:', err);
            return { docs: [] };
          }),
          // Commandes (pour calculer les coûts de livraison)
          getDocs(query(collection(db, 'orders'), where('isPaid', '==', true), orderBy('timestamp', 'desc'))).catch(err => {
            console.warn('⚠️ Erreur chargement orders:', err);
            return { docs: [] };
          })
        ]);

        // Traiter les dépenses générales
        const expensesData = expensesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'expense',
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        console.log('📊 Dépenses générales chargées:', expensesData.length);

        // Traiter les achats
        const purchasesData = purchasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'purchase',
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        console.log('🛒 Achats chargés:', purchasesData.length);

        // Traiter les dépenses de livraison
        const deliveryData = deliverySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'delivery',
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        console.log('🚚 Dépenses de livraison chargées:', deliveryData.length);

        // Traiter les listes d'achats de cuisine
        const purchaseListsData = purchaseListsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'purchaseList',
          createdAt: doc.data().date?.toDate?.() || new Date(doc.data().date)
        }));
        console.log('🛍️ Listes d\'achats chargées:', purchaseListsData.length);

        // Traiter les budgets comme des sorties
        const budgetsData = budgetsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'budget',
          createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
        }));
        console.log('💰 Budgets chargés:', budgetsData.length);

        // Traiter les commandes pour extraire les frais de livraison (éviter les doublons)
        const ordersData = ordersSnapshot.docs
          .filter(doc => {
            const data = doc.data();
            // Éviter les doublons avec les dépenses de livraison existantes
            return data.deliveryFee > 0 && !deliveryData.some(d => d.orderId === doc.id);
          })
          .map(doc => ({
            id: doc.id,
            description: `Frais de livraison commande #${doc.id.slice(-6)}`,
            amount: doc.data().deliveryFee,
            type: 'deliveryFee',
            createdAt: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
            orderId: doc.id // Pour éviter les doublons
          }));
        console.log('📦 Frais de livraison des commandes:', ordersData.length);

        // Combiner toutes les données (sans les ingrédients individuels)
        const allExpenses = [
          ...expensesData,
          ...purchasesData,
          ...deliveryData,
          ...purchaseListsData,
          ...budgetsData,
          ...ordersData
        ];

        console.log('📈 Total des dépenses combinées:', allExpenses.length);
        console.log('🔍 Détail par type:', {
          expenses: expensesData.length,
          purchases: purchasesData.length,
          delivery: deliveryData.length,
          purchaseLists: purchaseListsData.length,
          budgets: budgetsData.length,
          deliveryFees: ordersData.length
        });

        // Mettre à jour les états
        setExpenses(allExpenses);
        setPurchases(purchasesData);
        setDeliveryExpenses(deliveryData);
        setPurchaseLists(purchaseListsData);

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
    const allExpenses = expenses; // déjà combinées en amont
    
    console.log('🔄 Classification des dépenses:', {
      total: allExpenses.length
    });
    
    const classified = allExpenses.map(expense => {
      // Classification automatique basée sur les données existantes
      let department = 'divers';
      let category = 'other';
      
      // Classification par type de dépense
      if (expense.type === 'delivery' || expense.type === 'deliveryFee') {
        department = 'square';
        category = 'delivery';
      } else if (expense.type === 'purchase') {
        // Classification intelligente des achats
        const description = (expense.description || '').toLowerCase();
        const title = (expense.title || '').toLowerCase();
        const combinedText = `${description} ${title}`;

        // D'abord vérifier les équipements et autres catégories spécifiques
        if (combinedText.toLowerCase().includes('équipement') || combinedText.toLowerCase().includes('machine') || combinedText.toLowerCase().includes('cuisine')) {
          department = 'magedabord';
          category = 'equipment';
        } else {
          // Utiliser la classification intelligente pour les ingrédients
          const classifiedDept = classifyExpenseByContent(combinedText);
          if (classifiedDept) {
            department = classifiedDept;
            category = 'ingredients';
          } else {
            // Classification manuelle requise - mettre dans "divers" pour révision
            department = 'divers';
            category = 'other';
          }
        }
      } else if (expense.type === 'purchaseList') {
        // Classification intelligente des listes d'achats
        const description = (expense.description || '').toLowerCase();
        const brands = (expense.brands || []).join(' ').toLowerCase();
        const combinedText = `${description} ${brands}`;

        // Utiliser la classification intelligente
        const classifiedDept = classifyExpenseByContent(combinedText);
        if (classifiedDept) {
          department = classifiedDept;
          category = 'ingredients';
        } else {
          // Pour les listes d'achats non classables, privilégier Maged'Abord
          // car la plupart des achats de cuisine sont pour le restaurant principal
          department = 'magedabord';
          category = 'ingredients';
        }
      } else if (expense.type === 'budget') {
        // Les budgets sont classés selon leur département assigné
        department = expense.department || 'divers';
        category = 'other'; // Les budgets sont des sorties mais pas dans une catégorie spécifique
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
    
    console.log('✅ Dépenses classifiées:', classified.length);
    console.log('📊 Répartition par département:', 
      classified.reduce((acc, exp) => {
        acc[exp.classifiedDepartment] = (acc[exp.classifiedDepartment] || 0) + 1;
        return acc;
      }, {})
    );
    
    return classified;
  }, [expenses]);

  // Filtrer les dépenses selon la période et le département
  const filteredExpenses = useMemo(() => {
    let filtered = classifiedExpenses;

    console.log('🔍 Filtrage des dépenses:', {
      total: classifiedExpenses.length,
      selectedPeriod,
      selectedDepartment
    });

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

    console.log('✅ Dépenses filtrées:', filtered.length);
    
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

  // Ouvrir les détails d'une catégorie
  const openCategoryDetails = (category, expenses) => {
    setDetailsCategory(category);
    setDetailsExpenses(expenses);
    setShowDetailsModal(true);
  };

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

  // Message si aucune donnée
  if (classifiedExpenses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">📊 Classification des Sorties</h1>
          <p className="text-blue-100">Gestion et classification des dépenses par département</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucune donnée trouvée</h3>
          <p className="text-gray-600 mb-4">
            Aucune dépense n'a été trouvée dans les collections suivantes :
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-700">Collections vérifiées :</h4>
              <ul className="text-sm text-gray-600 mt-2 space-y-1">
                <li>• expenses (dépenses générales)</li>
                <li>• purchases (achats)</li>
                <li>• deliveryExpenses (dépenses livraison)</li>
                <li>• purchaseLists (listes d'achats)</li>
                <li>• budgets (budgets)</li>
                <li>• orders (commandes avec frais livraison)</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-700">Solutions :</h4>
              <ul className="text-sm text-blue-600 mt-2 space-y-1">
                <li>• Vérifiez les permissions Firebase</li>
                <li>• Créez des dépenses de test</li>
                <li>• Vérifiez la configuration</li>
                <li>• Consultez la console pour les erreurs</li>
              </ul>
            </div>
          </div>
        </div>
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

      {/* Section Sorties Principales */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">📊 Sorties Principales</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Dépenses des livreurs */}
          <div
            className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              const deliveryExpenses = filteredExpenses.filter(expense =>
                expense.type === 'delivery' || expense.type === 'deliveryFee' ||
                (expense.classifiedDepartment === 'square' && expense.classifiedCategory === 'delivery')
              );
              openCategoryDetails('Dépenses Livreurs', deliveryExpenses);
            }}
          >
            <div className="flex items-center space-x-3 mb-3">
              <FaTruck className="text-blue-600 text-xl" />
              <div>
                <h4 className="font-semibold text-blue-800">Dépenses Livreurs</h4>
                <p className="text-xs text-blue-600">Livraison & transport</p>
              </div>
            </div>
            <div className="space-y-2">
              {(() => {
                const deliveryExpenses = filteredExpenses.filter(expense =>
                  expense.type === 'delivery' || expense.type === 'deliveryFee' ||
                  (expense.classifiedDepartment === 'square' && expense.classifiedCategory === 'delivery')
                );
                const total = deliveryExpenses.reduce((sum, exp) => sum + (exp.amount || exp.total || 0), 0);
                return (
                  <>
                    <p className="text-2xl font-bold text-blue-800">{formatPrice(total)} FCFA</p>
                    <p className="text-sm text-blue-600">{deliveryExpenses.length} dépenses</p>
                    <p className="text-xs text-blue-500 mt-1">👆 Cliquez pour voir le détail</p>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Achats en cuisine */}
          <div
            className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              const kitchenExpenses = filteredExpenses.filter(expense =>
                expense.type === 'purchase' || expense.type === 'purchaseList' ||
                (expense.classifiedCategory === 'ingredients' || expense.classifiedCategory === 'equipment')
              );
              openCategoryDetails('Achats Cuisine', kitchenExpenses);
            }}
          >
            <div className="flex items-center space-x-3 mb-3">
              <FaUtensils className="text-green-600 text-xl" />
              <div>
                <h4 className="font-semibold text-green-800">Achats Cuisine</h4>
                <p className="text-xs text-green-600">Ingrédients & équipements</p>
              </div>
            </div>
            <div className="space-y-2">
              {(() => {
                const kitchenExpenses = filteredExpenses.filter(expense =>
                  expense.type === 'purchase' || expense.type === 'purchaseList' ||
                  (expense.classifiedCategory === 'ingredients' || expense.classifiedCategory === 'equipment')
                );
                const total = kitchenExpenses.reduce((sum, exp) => sum + (exp.amount || exp.total || 0), 0);
                return (
                  <>
                    <p className="text-2xl font-bold text-green-800">{formatPrice(total)} FCFA</p>
                    <p className="text-sm text-green-600">{kitchenExpenses.length} achats</p>
                    <p className="text-xs text-green-500 mt-1">👆 Cliquez pour voir le détail</p>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Dépenses de la compta */}
          <div
            className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              const accountingExpenses = filteredExpenses.filter(expense =>
                expense.type === 'expense' || expense.type === 'budget' ||
                expense.classifiedDepartment === 'divers'
              );
              openCategoryDetails('Dépenses Comptabilité', accountingExpenses);
            }}
          >
            <div className="flex items-center space-x-3 mb-3">
              <FaReceipt className="text-purple-600 text-xl" />
              <div>
                <h4 className="font-semibold text-purple-800">Dépenses Comptabilité</h4>
                <p className="text-xs text-purple-600">Administration & gestion</p>
              </div>
            </div>
            <div className="space-y-2">
              {(() => {
                const accountingExpenses = filteredExpenses.filter(expense =>
                  expense.type === 'expense' || expense.type === 'budget' ||
                  expense.classifiedDepartment === 'divers'
                );
                const total = accountingExpenses.reduce((sum, exp) => sum + (exp.amount || exp.total || 0), 0);
                return (
                  <>
                    <p className="text-2xl font-bold text-purple-800">{formatPrice(total)} FCFA</p>
                    <p className="text-sm text-purple-600">{accountingExpenses.length} dépenses</p>
                    <p className="text-xs text-purple-500 mt-1">👆 Cliquez pour voir le détail</p>
                  </>
                );
              })()}
            </div>
          </div>

        </div>
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
                          expense.type === 'purchaseList' ? '🛍️' : '🧾'}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{
                          (() => {
                            // Pour les dépenses de livraison, créer une description plus intelligente
                            if (expense.type === 'delivery' || expense.type === 'deliveryFee') {
                              if (expense.description && expense.description !== 'X' && expense.description.trim()) {
                                return expense.description;
                              }
                              // Utiliser la catégorie et le livreur pour créer une description
                              const category = expense.category || 'dépense';
                              const deliverer = expense.delivererName || expense.deliverer || '';
                              const categoryLabel = category === 'fuel' ? 'Carburant' : 
                                                  category === 'maintenance' ? 'Entretien' :
                                                  category === 'repair' ? 'Réparation' : 'Dépense';
                              return deliverer ? `${categoryLabel} - ${deliverer}` : categoryLabel;
                            }
                            // Pour les autres types, utiliser la logique existante
                            return expense.description || expense.title || (
                              expense.type === 'purchase'
                                ? 'Achat cuisine'
                                : expense.type === 'purchaseList'
                                  ? 'Liste d\'achats cuisine'
                                  : 'Dépense'
                            );
                          })()
                        }</div>
                        <div className="text-sm text-gray-500">{
                          expense.supplier || expense.supplierName || (
                            expense.type === 'delivery' || expense.type === 'deliveryFee'
                              ? (expense.delivererName || expense.deliverer || 'Frais de course')
                              : expense.type === 'purchase' || expense.type === 'purchaseList'
                                ? 'Cuisine'
                                : '-'
                          )
                        }</div>
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

      {/* Modale de détails des catégories */}
      <CategoryDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setDetailsCategory(null);
          setDetailsExpenses([]);
        }}
        category={detailsCategory}
        expenses={detailsExpenses}
      />
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

// Modale de détails des catégories
const CategoryDetailsModal = ({ isOpen, onClose, category, expenses }) => {
  if (!isOpen) return null;

  const total = expenses.reduce((sum, exp) => sum + (exp.amount || exp.total || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
      >
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">{category}</h2>
              <p className="text-sm text-gray-600">
                {expenses.length} dépenses • Total: {formatPrice(total)} FCFA
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-4">
            {expenses.map((expense) => (
              <div key={expense.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">
                      {expense.type === 'delivery' ? '🚚' :
                       expense.type === 'purchase' ? '🛒' :
                       expense.type === 'purchaseList' ? '🛍️' :
                       expense.type === 'deliveryFee' ? '🚚' : '🧾'}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">
                        {expense.description || expense.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        {expense.supplier || expense.supplierName || 'N/A'} •
                        {new Date(expense.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {formatPrice(expense.amount || expense.total || 0)} FCFA
                    </div>
                    <div className="text-xs text-gray-500">
                      {expense.classifiedDepartment && expense.classifiedCategory ?
                        `${CLASSIFICATION_SYSTEM.DEPARTMENTS[expense.classifiedDepartment]?.label} - ${CLASSIFICATION_SYSTEM.CATEGORIES[expense.classifiedCategory]?.label}` :
                        'Non classifié'
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Fonction d'export CSV
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
