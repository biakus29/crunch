import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  FaShoppingCart,
  FaPlus,
  FaCalendarAlt,
  FaCheck,
  FaTimes,
  FaEdit,
  FaTrash,
  FaEye,
  FaBoxes,
  FaMoneyBillWave,
  FaList,
  FaClock,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const SimplePurchaseManager = ({ currentRestaurantId, userRole }) => {
  // États principaux
  const [ingredients, setIngredients] = useState([]);
  const [labels, setLabels] = useState([]);
  const [purchaseLists, setPurchaseLists] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // États du formulaire
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [purchaseInfo, setPurchaseInfo] = useState({
    date: new Date().toISOString().split('T')[0],
    brands: [],
    notes: '',
    type: 'completed',
  });
  
  // États pour la visualisation
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  
  // États pour la modale d'édition des ingrédients
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [editForm, setEditForm] = useState({
    quantity: 1,
    selectedUnit: 'kg',
    unitPrice: 0
  });
  const [editingPurchase, setEditingPurchase] = useState(null);

  // Marques disponibles
  const brands = ["Crunchfood", "Mange d'abord"];

  // Actions rapides pour les dates
  const quickActions = [
    { id: 'today', label: 'Aujourd\'hui', icon: '📅' },
    { id: 'yesterday', label: 'Hier', icon: '📅' },
    { id: 'lastWeek', label: 'Semaine dernière', icon: '📆' },
    { id: 'lastMonth', label: 'Mois dernier', icon: '🗓️' },
  ];

  // Génération du mois précédent pour les rappels
  const generateMonthOptions = () => {
    const months = [];
    const today = new Date();
    
    // Seulement le mois précédent - calcul correct
    const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const lastMonthNumber = today.getMonth() === 0 ? 12 : today.getMonth();
    
    const monthName = new Date(lastMonthYear, lastMonthNumber - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const monthId = `${lastMonthYear}-${String(lastMonthNumber).padStart(2, '0')}`;
    
    console.log('Mois précédent calculé:', {
      today: today,
      lastMonthYear: lastMonthYear,
      lastMonthNumber: lastMonthNumber,
      monthName: monthName,
      monthId: monthId
    });
    
    months.push({
      id: monthId,
      label: monthName,
      icon: '📆',
      year: lastMonthYear,
      month: lastMonthNumber
    });
    
    return months;
  };

  const monthOptions = generateMonthOptions();

  // Charger les données
  useEffect(() => {
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Charger les ingrédients
      const ingredientsQuery = query(collection(db, 'ingredients'), orderBy('name'));
      const ingredientsSnap = await getDocs(ingredientsQuery);
      const ingredientsData = ingredientsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setIngredients(ingredientsData);

      // Charger les labels
      const labelsQuery = query(collection(db, 'labels'), orderBy('name'));
      const labelsSnap = await getDocs(labelsQuery);
      const labelsData = labelsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLabels(labelsData);

      // Charger les listes d'achats
      const purchasesQuery = query(
        collection(db, 'purchaseLists'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('date', 'desc')
      );
      const purchasesSnap = await getDocs(purchasesQuery);
      const lists = purchasesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPurchaseLists(lists);
      
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Gestion des actions rapides de date
  const handleQuickDate = (action) => {
    const today = new Date();
    let newDate;

    switch (action) {
      case 'today':
        newDate = new Date(today);
        break;
      case 'yesterday':
        newDate = new Date(today);
        newDate.setDate(today.getDate() - 1);
        break;
      case 'lastWeek':
        newDate = new Date(today);
        newDate.setDate(today.getDate() - 7);
        break;
      case 'lastMonth':
        newDate = new Date(today);
        newDate.setMonth(today.getMonth() - 1);
        break;
      default:
        // Vérifier si c'est un mois dynamique
        const monthOption = monthOptions.find(m => m.id === action);
        if (monthOption) {
          // Créer la date au 1er du mois sélectionné
          // Utiliser une approche qui évite les problèmes de timezone
          const year = monthOption.year;
          const month = monthOption.month;
          newDate = new Date(year, month - 1, 1);
          
          // Forcer la date au 1er du mois
          newDate.setHours(0, 0, 0, 0);
          
          console.log('Mois sélectionné:', monthOption);
          console.log('Date créée:', newDate);
          console.log('Date string:', newDate.toISOString().split('T')[0]);
        } else {
          return;
        }
        break;
    }

    const dateString = newDate.toISOString().split('T')[0];
    console.log('Date finale:', dateString);

    setPurchaseInfo(prev => ({
      ...prev,
      date: dateString
    }));
    
    const actionLabel = quickActions.find(a => a.id === action)?.label || 
                       monthOptions.find(m => m.id === action)?.label || 
                       'Date sélectionnée';
    toast.success(`Date changée pour ${actionLabel}`);
  };

  // Gestion de la sélection d'ingrédients
  const toggleIngredient = (ingredient) => {
    const exists = selectedIngredients.find(item => item.id === ingredient.id);
    if (exists) {
      // Si l'ingrédient existe déjà, ouvrir la modale d'édition
      openEditModal(exists);
    } else {
      // Si c'est un nouvel ingrédient, l'ajouter avec des valeurs par défaut
      const newIngredient = {
        ...ingredient,
        quantity: 1,
        selectedUnit: ingredient.unit || 'kg',
        unitPrice: ingredient.unitPrice || 0,
        total: (ingredient.unitPrice || 0) * 1
      };
      setSelectedIngredients(prev => [...prev, newIngredient]);
      openEditModal(newIngredient);
    }
  };

  // Ouvrir la modale d'édition
  const openEditModal = (ingredient) => {
    setEditingIngredient(ingredient);
    setEditForm({
      quantity: ingredient.quantity || 1,
      selectedUnit: ingredient.selectedUnit || 'kg',
      unitPrice: ingredient.unitPrice || 0
    });
    setShowEditModal(true);
  };

  // Fermer la modale d'édition
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingIngredient(null);
    setEditForm({
      quantity: 1,
      selectedUnit: 'kg',
      unitPrice: 0
    });
  };

  // Sauvegarder les modifications de l'ingrédient
  const saveIngredientEdit = () => {
    if (!editingIngredient) return;

    const updatedIngredient = {
      ...editingIngredient,
      quantity: editForm.quantity,
      selectedUnit: editForm.selectedUnit,
      unitPrice: editForm.unitPrice,
      total: editForm.quantity * editForm.unitPrice
    };

    setSelectedIngredients(prev => 
      prev.map(item => 
        item.id === editingIngredient.id ? updatedIngredient : item
      )
    );

    closeEditModal();
  };

  // Retirer un ingrédient
  const removeIngredient = () => {
    if (!editingIngredient) return;
    
    setSelectedIngredients(prev => 
      prev.filter(item => item.id !== editingIngredient.id)
    );
    
    closeEditModal();
  };

  // Mise à jour d'un ingrédient sélectionné
  const updateSelectedIngredient = (ingredientId, field, value) => {
    setSelectedIngredients(prev => prev.map(item => {
      if (item.id === ingredientId) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  // Supprimer un ingrédient sélectionné
  const removeSelectedIngredient = (ingredientId) => {
    setSelectedIngredients(prev => prev.filter(item => item.id !== ingredientId));
  };

  // Gestion des marques
  const toggleBrand = (brand) => {
    setPurchaseInfo(prev => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter(b => b !== brand)
        : [...prev.brands, brand]
    }));
  };

  // Sauvegarder l'achat
  const savePurchase = async () => {
    if (selectedIngredients.length === 0) {
      toast.error("Ajoutez au moins un ingrédient");
      return;
    }
    if (purchaseInfo.brands.length === 0) {
      toast.error("Sélectionnez au moins une marque");
      return;
    }

    try {
      const totalAmount = selectedIngredients.reduce((sum, item) => sum + item.total, 0);
      const purchaseData = {
        ...purchaseInfo,
        items: selectedIngredients.map(item => ({
          ingredientId: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.selectedUnit,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        total: totalAmount,
        restaurantId: currentRestaurantId,
        status: 'approved',
        createdAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        approvedBy: 'system'
      };

      if (editingPurchase) {
        // Mise à jour d'un achat existant
        await updateDoc(doc(db, "purchaseLists", editingPurchase.id), purchaseData);
        toast.success("Achat modifié avec succès !");
      } else {
        // Création d'un nouvel achat
        await addDoc(collection(db, "purchaseLists"), purchaseData);
        toast.success("Achat enregistré avec succès !");
      }
      
      // Réinitialiser
      setShowModal(false);
      setCurrentStep(1);
      setSelectedIngredients([]);
      setEditingPurchase(null);
      setPurchaseInfo({
        date: new Date().toISOString().split('T')[0],
        brands: [],
        notes: '',
        type: 'completed',
      });
      loadData();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  // Actions CRUD
  const handleViewPurchase = (purchase) => {
    setSelectedPurchase(purchase);
    setShowViewModal(true);
  };

  const handleEditPurchase = (purchase) => {
    // Pré-remplir le formulaire
    setPurchaseInfo({
      date: purchase.date,
      brands: purchase.brands || [],
      notes: purchase.notes || '',
      type: 'completed',
    });
    
    // Pré-remplir les ingrédients sélectionnés
    if (purchase.items && purchase.items.length > 0) {
      const selectedItems = purchase.items.map(item => {
        const ingredient = ingredients.find(ing => ing.id === item.ingredientId);
        if (ingredient) {
          return {
            ...ingredient,
            quantity: item.quantity,
            selectedUnit: item.unit,
            unitPrice: item.unitPrice,
            total: item.total,
          };
        }
        return null;
      }).filter(Boolean);
      
      setSelectedIngredients(selectedItems);
    }
    
    setEditingPurchase(purchase);
    setShowViewModal(false);
    setShowModal(true);
    toast.info("Données chargées pour modification");
  };

  const handleDeletePurchase = async (purchaseId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette liste d\'achat ?')) return;
    
    try {
      await deleteDoc(doc(db, "purchaseLists", purchaseId));
      toast.success("Achat supprimé avec succès");
      loadData();
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Filtrer les ingrédients
  const filteredIngredients = ingredients.filter(ingredient => {
    const matchesSearch = ingredient.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLabel = !selectedLabel || ingredient.labelId === selectedLabel;
    return matchesSearch && matchesLabel;
  });

  // Grouper les ingrédients par première lettre
  const groupedIngredients = filteredIngredients.reduce((groups, ingredient) => {
    const firstLetter = ingredient.name.charAt(0).toUpperCase();
    if (!groups[firstLetter]) {
      groups[firstLetter] = [];
    }
    groups[firstLetter].push(ingredient);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Mobile First */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800">Gestion des Achats d'Ingrédients</h3>
            <p className="text-base sm:text-lg text-gray-600 mt-1">Créez et gérez vos listes d'achats simplement</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center space-x-2 text-base sm:text-lg"
          >
            <FaPlus />
            <span>Nouvel Achat</span>
          </button>
        </div>
      </div>

      {/* Liste des achats récents - Mobile First */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-4">🛒 Achats récents</h3>
        {purchaseLists.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <FaShoppingCart className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg text-gray-500 mb-4">Aucun achat enregistré pour le moment.</p>
            <button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 text-base sm:text-lg"
            >
              Créer le premier achat
            </button>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {purchaseLists.slice(0, 10).map((list) => (
              <div key={list.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors gap-3 sm:gap-4">
                <div className="flex items-center space-x-3 sm:space-x-4 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <FaCheck className="text-green-600 text-sm sm:text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-base sm:text-lg truncate">{list.date}</p>
                    <p className="text-base sm:text-lg text-gray-600 truncate">
                      {list.brands?.join(', ') || 'Sans marque'} • {list.items?.length || 0} articles
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-4">
                  <div className="text-left sm:text-right">
                    <p className="text-lg sm:text-xl font-bold text-green-600">
                      {(list.total || 0).toLocaleString()} FCFA
                    </p>
                  </div>
                  <div className="flex space-x-1 sm:space-x-2">
                    <button
                      onClick={() => handleViewPurchase(list)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Voir les détails"
                    >
                      <FaEye className="text-base sm:text-lg" />
                    </button>
                    <button
                      onClick={() => handleEditPurchase(list)}
                      className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <FaEdit className="text-base sm:text-lg" />
                    </button>
                    <button
                      onClick={() => handleDeletePurchase(list.id)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <FaTrash className="text-base sm:text-lg" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de création/édition */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full h-[95vh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header - Mobile First */}
              <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-blue-50 to-green-50">
                <div className="flex justify-between items-start sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">
                      {editingPurchase ? 'Modifier l\'Achat' : 'Nouvel Achat d\'Ingrédients'}
                    </h3>
                    <p className="text-base sm:text-lg text-gray-600 mt-1">
                      {editingPurchase ? 'Modifiez les détails de votre achat' : 'Créez une nouvelle liste d\'achats'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setCurrentStep(1);
                      setSelectedIngredients([]);
                      setEditingPurchase(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 flex-shrink-0"
                  >
                    <FaTimes size={20} className="sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* Contenu - Mobile First */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {/* Navigation des étapes */}
                <div className="flex items-center justify-center mb-4 sm:mb-6">
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    {[1, 2, 3].map((step) => (
                      <div key={step} className="flex items-center">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-medium ${
                          currentStep >= step 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {step}
                        </div>
                        {step < 3 && (
                          <div className={`w-4 sm:w-8 h-0.5 mx-1 sm:mx-2 ${
                            currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Étape 1: Informations générales - Mobile First */}
                {currentStep === 1 && (
                  <div className="space-y-4 sm:space-y-6">
                    <h4 className="text-lg sm:text-xl font-semibold text-gray-800">📅 Informations générales</h4>
                    
                    {/* Sélection de date */}
                    <div className="space-y-3 sm:space-y-4">
                      <div className="mb-3 sm:mb-4 p-3 bg-white rounded-lg border-2 border-blue-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-base sm:text-lg text-gray-600">Date sélectionnée :</p>
                            <p className="text-base sm:text-xl font-bold text-blue-600">
                              {new Date(purchaseInfo.date).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <input
                            type="date"
                            value={purchaseInfo.date}
                            onChange={(e) => setPurchaseInfo({ ...purchaseInfo, date: e.target.value })}
                            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                          />
                        </div>
                      </div>

                      {/* Actions rapides - Mobile First */}
                      <div>
                        <p className="text-base sm:text-lg font-medium text-gray-700 mb-2 sm:mb-3">Sélection rapide :</p>
                        <div className="space-y-2 sm:space-y-3">
                          <div>
                            <p className="text-base font-medium text-gray-500 mb-2">Dates récentes :</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
                              {quickActions.map((action) => (
                                <button
                                  key={action.id}
                                  onClick={() => handleQuickDate(action.id)}
                                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-base sm:text-lg bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 group"
                                  title={action.label}
                                >
                                  <span className="text-sm sm:text-lg">{action.icon}</span>
                                  <span className="font-medium text-blue-700 group-hover:text-blue-800 truncate">
                                    {action.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Rappel du mois précédent - Mobile First */}
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-2">Rappel du mois précédent :</p>
                            <div className="flex justify-center">
                              {monthOptions.map((month) => (
                                <button
                                  key={month.id}
                                  onClick={() => handleQuickDate(month.id)}
                                  className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 text-base sm:text-lg bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 hover:border-orange-300 transition-all duration-200 group"
                                  title={month.label}
                                >
                                  <span className="text-sm sm:text-lg">{month.icon}</span>
                                  <span className="font-medium text-orange-700 group-hover:text-orange-800 truncate">
                                    {month.label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sélection des marques - Mobile First */}
                    <div>
                      <label className="block text-base sm:text-lg font-medium text-gray-700 mb-2">Marques *</label>
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {brands.map((brand) => (
                          <button
                            key={brand}
                            onClick={() => toggleBrand(brand)}
                            className={`px-3 sm:px-4 py-2 rounded-lg border transition-all duration-200 text-base sm:text-lg ${
                              purchaseInfo.brands.includes(brand)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                            }`}
                          >
                            {brand}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notes - Mobile First */}
                    <div>
                      <label className="block text-base sm:text-lg font-medium text-gray-700 mb-2">Notes (optionnel)</label>
                      <textarea
                        value={purchaseInfo.notes}
                        onChange={(e) => setPurchaseInfo({ ...purchaseInfo, notes: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        rows="3"
                        placeholder="Ajoutez des notes sur cet achat..."
                      />
                    </div>
                  </div>
                )}

                {/* Étape 2: Sélection des ingrédients - Mobile First */}
                {currentStep === 2 && (
                  <div className="space-y-4 sm:space-y-6">
                    <h4 className="text-xl sm:text-2xl font-semibold text-gray-800">🥬 Sélection des ingrédients</h4>
                    
                    {/* Recherche et filtres - Mobile First */}
                    <div className="flex flex-col gap-3 sm:gap-4">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Rechercher un ingrédient..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        />
                      </div>
                      <div>
                        <select
                          value={selectedLabel}
                          onChange={(e) => setSelectedLabel(e.target.value)}
                          className="w-full sm:w-auto border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        >
                          <option value="">Tous les labels</option>
                          {labels.map((label) => (
                            <option key={label.id} value={label.id}>
                              {label.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Liste des ingrédients - Mobile First */}
                    <div className="max-h-80 sm:max-h-96 overflow-y-auto">
                      {Object.entries(groupedIngredients).map(([letter, items]) => (
                        <div key={letter} className="mb-4 sm:mb-6">
                          <h5 className="text-sm sm:text-base font-semibold text-gray-500 mb-2 sticky top-0 bg-white py-1">
                            {letter}
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
                            {items.map((ingredient) => {
                              const isSelected = selectedIngredients.find(item => item.id === ingredient.id);
                              return (
                                <button
                                  key={ingredient.id}
                                  onClick={() => toggleIngredient(ingredient)}
                                  className={`p-3 sm:p-4 rounded-lg border text-left transition-all duration-200 ${
                                    isSelected
                                      ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-md'
                                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                  }`}
                                >
                                  <div className="space-y-2">
                                    {/* Nom de l'ingrédient */}
                                    <div className="flex items-center justify-between">
                                      <p className="font-medium text-base sm:text-lg truncate">{ingredient.name}</p>
                                      {isSelected && (
                                        <FaCheck className="text-blue-600 text-base sm:text-lg flex-shrink-0 ml-2" />
                                      )}
                                    </div>
                                    
                                    
                                    {/* Informations détaillées si sélectionné */}
                                    {isSelected && (
                                      <div className="bg-white rounded-lg p-2 border border-blue-200">
                                        <div className="flex justify-between items-center text-sm sm:text-base">
                                          <span className="text-gray-600">
                                            Quantité: <span className="font-semibold text-blue-800">{isSelected.quantity} {isSelected.selectedUnit}</span>
                                          </span>
                                          <span className="font-bold text-green-600">
                                            Total: {isSelected.total.toLocaleString()} FCFA
                                          </span>
                                        </div>
                                        <div className="text-sm text-blue-600 mt-1 text-center">
                                          Cliquer pour modifier
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                )}

                {/* Étape 3: Récapitulatif - Mobile First */}
                {currentStep === 3 && (
                  <div className="space-y-4 sm:space-y-6">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-800">📋 Récapitulatif de l'achat</h4>
                    
                    {/* Informations générales - Mobile First */}
                    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <h5 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Informations générales</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div>
                          <span className="text-gray-600">Date:</span>
                          <span className="ml-2 font-medium">{purchaseInfo.date}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Marques:</span>
                          <span className="ml-2 font-medium">{purchaseInfo.brands.join(', ')}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total:</span>
                          <span className="ml-2 font-bold text-green-600">
                            {selectedIngredients.reduce((sum, item) => sum + item.total, 0).toLocaleString()} FCFA
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Articles:</span>
                          <span className="ml-2 font-medium">{selectedIngredients.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Liste des produits - Mobile First */}
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Produits sélectionnés</h5>
                      <div className="space-y-2">
                        {selectedIngredients.map((item) => (
                          <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-2 sm:p-3 bg-white border rounded-lg gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm sm:text-base truncate">{item.name}</p>
                              <p className="text-xs sm:text-sm text-gray-500">
                                {item.quantity} {item.selectedUnit} @ {item.unitPrice.toLocaleString()} FCFA
                              </p>
                            </div>
                            <p className="font-bold text-green-600 text-sm sm:text-base text-right">
                              {item.total.toLocaleString()} FCFA
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer - Mobile First */}
              <div className="p-4 sm:p-6 border-t bg-white">
                <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
                  <button
                    onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : setShowModal(false)}
                    className="w-full sm:w-auto px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
                  >
                    {currentStep > 1 ? 'Précédent' : 'Annuler'}
                  </button>
                  <div className="flex space-x-2 sm:space-x-3">
                    {currentStep < 3 ? (
                      <button
                        onClick={() => setCurrentStep(currentStep + 1)}
                        className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                      >
                        Suivant
                      </button>
                    ) : (
                      <button
                        onClick={savePurchase}
                        className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
                      >
                        <FaCheck />
                        <span>Enregistrer l'achat</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de visualisation des détails d'achat */}
      <AnimatePresence>
        {showViewModal && selectedPurchase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
            onClick={(e) => e.target === e.currentTarget && setShowViewModal(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full h-[90vh] sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-green-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Détails de l'Achat</h3>
                    <p className="text-gray-600">Vérifiez les éléments ajoutés</p>
                  </div>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>
              </div>

              {/* Contenu */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Informations générales */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-3">Informations générales</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Date:</span>
                        <span className="ml-2 font-medium">{selectedPurchase.date}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Marques:</span>
                        <span className="ml-2 font-medium">{selectedPurchase.brands?.join(', ') || 'Non spécifiées'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Statut:</span>
                        <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {selectedPurchase.status || 'Approuvé'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total financier */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Résumé financier</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total de la liste:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {(selectedPurchase.total || 0).toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>

                  {/* Liste des ingrédients */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">Ingrédients achetés ({selectedPurchase.items?.length || 0})</h4>
                    {selectedPurchase.items && selectedPurchase.items.length > 0 ? (
                      <div className="space-y-3">
                        {selectedPurchase.items.map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-lg">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-800">{item.name}</h5>
                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                                <span>Quantité: <strong>{item.quantity}</strong> {item.unit}</span>
                                <span>Prix unitaire: <strong>{item.unitPrice?.toLocaleString()} FCFA</strong></span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                {item.total?.toLocaleString()} FCFA
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">Aucun ingrédient trouvé</p>
                    )}
                  </div>

                  {/* Notes */}
                  {selectedPurchase.notes && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">Notes</h4>
                      <p className="text-gray-700">{selectedPurchase.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t bg-white">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Fermer
                  </button>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleEditPurchase(selectedPurchase)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                      <FaEdit />
                      <span>Modifier</span>
                    </button>
                    <button
                      onClick={() => handleDeletePurchase(selectedPurchase.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                    >
                      <FaTrash />
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Modale d'édition des ingrédients */}
      {showEditModal && editingIngredient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Modifier l'ingrédient
                </h3>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-4">
                {/* Nom de l'ingrédient */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ingrédient
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-800">{editingIngredient.name}</span>
                  </div>
                </div>

                {/* Quantité */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm(prev => ({
                      ...prev,
                      quantity: Number(e.target.value) || 0
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0.1"
                    step="0.1"
                    placeholder="Entrez la quantité"
                  />
                </div>

                {/* Unité */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unité
                  </label>
                  <select
                    value={editForm.selectedUnit}
                    onChange={(e) => setEditForm(prev => ({
                      ...prev,
                      selectedUnit: e.target.value
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="pièce">pièce</option>
                    <option value="boîte">boîte</option>
                    <option value="sachet">sachet</option>
                    <option value="bouteille">bouteille</option>
                  </select>
                </div>

                {/* Prix unitaire */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix unitaire (FCFA)
                  </label>
                  <input
                    type="number"
                    value={editForm.unitPrice}
                    onChange={(e) => setEditForm(prev => ({
                      ...prev,
                      unitPrice: Number(e.target.value) || 0
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    placeholder="Entrez le prix unitaire"
                  />
                </div>

                {/* Prix total */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Prix total :</span>
                    <span className="font-bold text-green-600 text-lg">
                      {(editForm.quantity * editForm.unitPrice).toLocaleString()} FCFA
                    </span>
                  </div>
                </div>

                {/* Boutons d'action */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={removeIngredient}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center"
                  >
                    <FaTimes className="mr-2" />
                    Retirer
                  </button>
                  <button
                    onClick={saveIngredientEdit}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
                  >
                    <FaCheck className="mr-2" />
                    Sauvegarder
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimplePurchaseManager;