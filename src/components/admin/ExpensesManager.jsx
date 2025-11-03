import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  FaReceipt,
  FaPlus,
  FaEdit,
  FaTrash,
  FaTags,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaFileInvoice,
  FaSearch,
  FaFilter,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ExpensesManager = ({ currentRestaurantId, userRole }) => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [motorcycles, setMotorcycles] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [menus, setMenus] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('all'); // 'all' ou restaurantId
  const [deliverers, setDeliverers] = useState([]);
  const [selectedMenu, setSelectedMenu] = useState('all'); // 'all' ou menuId
  const [selectedDepartment, setSelectedDepartment] = useState('all'); // 'all' ou department
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'expense' ou 'category'
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    supplier: '',
    notes: '',
    type: 'fixed',
    motorcycleId: '',
    delivererId: '',
    menuId: '', // MangedAbord ou Crunch
    department: userRole === 'delivery_manager' ? 'livraison' : 'general' // Forcer livraison pour delivery_manager
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    type: 'fixed',
    color: '#3B82F6'
  });

  const EXPENSE_TYPES = [
    { value: 'fixed', label: 'Charge fixe', description: 'Loyer, salaires, assurances...' },
    { value: 'variable', label: 'Charge variable', description: 'Eau, électricité, gaz...' }
  ];

  const DEPARTMENTS = [
    { value: 'maged', label: '🍽️ Maged\'Abord', description: 'Dépenses spécifiques à Maged\'Abord', color: '#EF4444' },
    { value: 'crunch', label: '🥪 Crunch', description: 'Dépenses spécifiques à Crunch', color: '#F59E0B' },
    { value: 'square', label: '🏪 Square', description: 'Dépenses spécifiques à Square', color: '#8B5CF6' },
    { value: 'livraison', label: '🚚 Service Livraison', description: 'Dépenses du service de livraison', color: '#10B981' },
    { value: 'general', label: '🏢 Autres Dépenses', description: 'Autres dépenses générales', color: '#6B7280' }
  ];

  const CATEGORY_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];

  useEffect(() => {
    // Charger les restaurants si currentRestaurantId est null (comptable)
    if (!currentRestaurantId) {
      loadRestaurants();
    }
    loadData();
    loadMenus();
    loadMotorcycles();
    loadDeliverers();
  }, [currentRestaurantId, selectedRestaurant]);

  const loadDeliverers = async () => {
    try {
      const filterRestaurantId = currentRestaurantId || (selectedRestaurant !== 'all' ? selectedRestaurant : null);
      const delivQuery = filterRestaurantId
        ? query(collection(db, 'deliverers'), where('restaurantId', '==', filterRestaurantId), orderBy('name'))
        : query(collection(db, 'deliverers'), orderBy('name'));
      const delivSnap = await getDocs(delivQuery);
      setDeliverers(delivSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Erreur chargement livreurs:', error);
    }
  };

  const loadMotorcycles = async () => {
    try {
      const filterRestaurantId = currentRestaurantId || (selectedRestaurant !== 'all' ? selectedRestaurant : null);
      const motosQuery = filterRestaurantId
        ? query(collection(db, 'motorcycles'), where('restaurantId', '==', filterRestaurantId), orderBy('brand'))
        : query(collection(db, 'motorcycles'), orderBy('brand'));
      const motosSnap = await getDocs(motosQuery);
      setMotorcycles(motosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Erreur chargement motos:', error);
    }
  };

  const loadRestaurants = async () => {
    try {
      const restaurantsSnap = await getDocs(collection(db, 'restaurants'));
      const restaurantsData = restaurantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRestaurants(restaurantsData);
    } catch (error) {
      console.error('Erreur chargement restaurants:', error);
    }
  };

  const loadMenus = async () => {
    try {
      const filterRestaurantId = currentRestaurantId || (selectedRestaurant !== 'all' ? selectedRestaurant : null);
      const menusQuery = filterRestaurantId
        ? query(collection(db, 'menus'), where('restaurantId', '==', filterRestaurantId))
        : collection(db, 'menus');
      const menusSnap = await getDocs(menusQuery);
      const menusData = menusSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMenus(menusData);
    } catch (error) {
      console.error('Erreur chargement menus:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Déterminer le filtre restaurant
      const filterRestaurantId = currentRestaurantId || (selectedRestaurant !== 'all' ? selectedRestaurant : null);
      
      // Pour le gestionnaire de livraison, filtrer par département livraison
      let expensesQuery;
      if (userRole === 'delivery_manager') {
        expensesQuery = filterRestaurantId
          ? query(collection(db, 'expenses'), where('restaurantId', '==', filterRestaurantId), where('department', '==', 'livraison'), orderBy('date', 'desc'))
          : query(collection(db, 'expenses'), where('department', '==', 'livraison'), orderBy('date', 'desc'));
      } else {
        expensesQuery = filterRestaurantId
          ? query(collection(db, 'expenses'), where('restaurantId', '==', filterRestaurantId), orderBy('date', 'desc'))
          : query(collection(db, 'expenses'), orderBy('date', 'desc'));
      }
      
      const categoriesQuery = filterRestaurantId
        ? query(collection(db, 'expenseCategories'), where('restaurantId', '==', filterRestaurantId), orderBy('name'))
        : query(collection(db, 'expenseCategories'), orderBy('name'));

      const [expensesSnap, categoriesSnap] = await Promise.all([
        getDocs(expensesQuery),
        getDocs(categoriesQuery),
      ]);

      setExpenses(expensesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setCategories(categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
      setLoading(false);
    }
  };

  // Fonctions CRUD pour les dépenses
  const handleCreateExpense = async () => {
    try {
      const newErrors = {};
      if (!expenseForm.description.trim()) newErrors.description = true;
      if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) newErrors.amount = true;
      if (!expenseForm.categoryId) newErrors.categoryId = true;
      if (!expenseForm.date) newErrors.date = true;

      setErrors(newErrors);
      if (Object.keys(newErrors).length) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      setIsSubmitting(true);
      if (selectedItem) {
        await updateExpense();
        toast.success('Dépense modifiée avec succès');
      } else {
        await createExpense();
        toast.success('Dépense créée avec succès');
      }
    } catch (error) {
      console.error('Erreur dépense:', error);
      toast.error(`Erreur lors de ${selectedItem ? 'la modification' : 'la création'} de la dépense`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const createExpense = async () => {
    await addDoc(collection(db, 'expenses'), {
      description: expenseForm.description.trim(),
      amount: parseFloat(expenseForm.amount),
      categoryId: expenseForm.categoryId,
      date: expenseForm.date,
      invoiceNumber: expenseForm.invoiceNumber.trim(),
      supplier: expenseForm.supplier.trim(),
      notes: expenseForm.notes.trim(),
      type: expenseForm.type,
      motorcycleId: expenseForm.motorcycleId || '',
      delivererId: expenseForm.delivererId || '',
      menuId: expenseForm.menuId || '',
      department: expenseForm.department || 'general',
      restaurantId: currentRestaurantId || selectedRestaurant,
      createdBy: auth.currentUser?.email || 'unknown',
      createdAt: serverTimestamp(),
    });
    setShowModal(false);
    resetExpenseForm();
    loadData();
  };

  const updateExpense = async () => {
    await updateDoc(doc(db, 'expenses', selectedItem.id), {
      description: expenseForm.description.trim(),
      amount: parseFloat(expenseForm.amount),
      categoryId: expenseForm.categoryId,
      date: expenseForm.date,
      motorcycleId: expenseForm.motorcycleId || '',
      delivererId: expenseForm.delivererId || '',
      invoiceNumber: expenseForm.invoiceNumber.trim(),
      supplier: expenseForm.supplier.trim(),
      notes: expenseForm.notes.trim(),
      type: expenseForm.type,
      menuId: expenseForm.menuId || '',
      department: expenseForm.department || 'general',
      updatedAt: serverTimestamp(),
    });
    setShowModal(false);
    resetExpenseForm();
    setSelectedItem(null);
    loadData();
  };

  const handleEditExpense = (expense) => {
    // Vérifier les permissions : seuls comptable et gérant peuvent tout modifier
    // Les autres rôles ne peuvent modifier que leurs propres départements
    if (userRole === 'delivery_manager' && expense.department !== 'livraison') {
      toast.error('Vous ne pouvez modifier que les dépenses du département Livraison');
      return;
    }
    
    setSelectedItem(expense);
    setExpenseForm({
      description: expense.description,
      amount: expense.amount.toString(),
      categoryId: expense.categoryId,
      date: expense.date,
      motorcycleId: expense.motorcycleId || '',
      delivererId: expense.delivererId || '',
      invoiceNumber: expense.invoiceNumber || '',
      supplier: expense.supplier || '',
      notes: expense.notes || '',
      type: expense.type || 'fixed',
      menuId: expense.menuId || '',
      department: expense.department || 'general'
    });
    setModalType('expense');
    setShowModal(true);
  };

  const handleDeleteExpense = async (expenseId, expense) => {
    // Vérifier les permissions : seuls comptable et gérant peuvent tout supprimer
    if (userRole === 'delivery_manager' && expense.department !== 'livraison') {
      toast.error('Vous ne pouvez supprimer que les dépenses du département Livraison');
      return;
    }
    
    // Si l'utilisateur est comptable ou gérant, suppression directe
    if (userRole === 'accountant' || userRole === 'manager') {
      if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) return;
      
      try {
        await deleteDoc(doc(db, 'expenses', expenseId));
        toast.success('Dépense supprimée avec succès');
        loadData();
      } catch (error) {
        console.error('Erreur suppression dépense:', error);
        toast.error('Erreur lors de la suppression de la dépense');
      }
      return;
    }
    
    // Pour les autres rôles, créer une demande d'approbation
    if (!window.confirm('Demander l\'approbation pour supprimer cette dépense ?')) return;
    
    try {
      await addDoc(collection(db, 'expenseDeletionRequests'), {
        expenseId: expenseId,
        expenseData: expense,
        requestedBy: userRole,
        requestedAt: serverTimestamp(),
        status: 'pending', // 'pending', 'approved', 'rejected'
        restaurantId: currentRestaurantId || expense.restaurantId
      });
      
      toast.success('Demande de suppression envoyée pour approbation');
    } catch (error) {
      console.error('Erreur création demande:', error);
      toast.error('Erreur lors de la création de la demande');
    }
  };

  // Fonctions CRUD pour les catégories
  const handleCreateCategory = async () => {
    try {
      const newErrors = {};
      if (!categoryForm.name.trim()) newErrors.name = true;
      setErrors(newErrors);
      if (Object.keys(newErrors).length) {
        toast.error('Veuillez remplir le nom de la catégorie');
        return;
      }

      setIsSubmitting(true);
      if (selectedItem) {
        await updateCategory();
        toast.success('Catégorie modifiée avec succès');
      } else {
        await createCategory();
        toast.success('Catégorie créée avec succès');
      }
    } catch (error) {
      console.error('Erreur catégorie:', error);
      toast.error(`Erreur lors de ${selectedItem ? 'la modification' : 'la création'} de la catégorie`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const createCategory = async () => {
    await addDoc(collection(db, 'expenseCategories'), {
      name: categoryForm.name.trim(),
      description: categoryForm.description.trim(),
      type: categoryForm.type,
      color: categoryForm.color,
      restaurantId: currentRestaurantId,
      createdAt: serverTimestamp(),
    });
    setShowModal(false);
    resetCategoryForm();
    loadData();
  };

  const updateCategory = async () => {
    await updateDoc(doc(db, 'expenseCategories', selectedItem.id), {
      name: categoryForm.name.trim(),
      description: categoryForm.description.trim(),
      type: categoryForm.type,
      color: categoryForm.color,
      updatedAt: serverTimestamp(),
    });
    setShowModal(false);
    resetCategoryForm();
    setSelectedItem(null);
    loadData();
  };

  const handleEditCategory = (category) => {
    setSelectedItem(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      type: category.type || 'fixed',
      color: category.color || '#3B82F6'
    });
    setModalType('category');
    setShowModal(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    const expensesWithCategory = expenses.filter(exp => exp.categoryId === categoryId);
    if (expensesWithCategory.length > 0) {
      toast.error('Impossible de supprimer une catégorie utilisée par des dépenses');
      return;
    }

    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;
    
    try {
      await deleteDoc(doc(db, 'expenseCategories', categoryId));
      toast.success('Catégorie supprimée avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur suppression catégorie:', error);
      toast.error('Erreur lors de la suppression de la catégorie');
    }
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      description: '',
      amount: '',
      categoryId: '',
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: '',
      supplier: '',
      notes: '',
      type: 'fixed'
      ,motorcycleId: '',
      delivererId: ''
    });
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      type: 'fixed',
      color: '#3B82F6'
    });
  };

  if (loading) {
    return (
      <div className="p-4 text-center sm:p-6">
        <FaReceipt className="animate-spin h-5 w-5 mx-auto text-blue-600 sm:h-6 sm:w-6" />
        <span className="text-gray-600 text-sm sm:text-base">Chargement...</span>
      </div>
    );
  }

  // Filtrage des dépenses
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || expense.categoryId === selectedCategory;
    const matchesMonth = !selectedMonth || expense.date.startsWith(selectedMonth);
    const matchesMenu = selectedMenu === 'all' || expense.menuId === selectedMenu;
    const matchesDepartment = selectedDepartment === 'all' || expense.department === selectedDepartment;
    
    return matchesSearch && matchesCategory && matchesMonth && matchesMenu && matchesDepartment;
  });

  // Calculs statistiques
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const fixedExpenses = filteredExpenses.filter(exp => exp.type === 'fixed').reduce((sum, exp) => sum + exp.amount, 0);
  const variableExpenses = filteredExpenses.filter(exp => exp.type === 'variable').reduce((sum, exp) => sum + exp.amount, 0);

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Catégorie inconnue';
  };

  const getCategoryColor = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.color : '#6B7280';
  };

  return (
    <div className="p-4 sm:p-6">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      
      <div className="space-y-6">
        {/* Header avec statistiques */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-col justify-between items-start gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">Gestion des Dépenses</h3>
              <p className="text-sm text-gray-600">Dépenses hors production (charges fixes et variables)</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalType('category');
                  setShowModal(true);
                  resetCategoryForm();
                  setSelectedItem(null);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 flex items-center"
              >
                <FaTags className="mr-2" /> Nouvelle Catégorie
              </button>
              <button
                onClick={() => {
                  setModalType('expense');
                  setShowModal(true);
                  resetExpenseForm();
                  setSelectedItem(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 flex items-center"
              >
                <FaPlus className="mr-2" /> Nouvelle Dépense
              </button>
            </div>
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <FaMoneyBillWave className="text-blue-600 text-2xl mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Total des dépenses</p>
                  <p className="text-xl font-bold text-blue-900">{totalExpenses.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center">
                <FaFileInvoice className="text-red-600 text-2xl mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-800">Charges fixes</p>
                  <p className="text-xl font-bold text-red-900">{fixedExpenses.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center">
                <FaReceipt className="text-yellow-600 text-2xl mr-3" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Charges variables</p>
                  <p className="text-xl font-bold text-yellow-900">{variableExpenses.toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* Sélecteur de restaurant (uniquement pour le comptable) */}
            {!currentRestaurantId && restaurants.length > 0 && (
              <select
                value={selectedRestaurant}
                onChange={(e) => setSelectedRestaurant(e.target.value)}
                className="px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-sm"
              >
                <option value="all">🏪 Tous les restaurants</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            )}
            
            {/* Sélecteur de menu */}
            <select
              value={selectedMenu}
              onChange={(e) => setSelectedMenu(e.target.value)}
              className="px-3 py-2 border border-purple-300 bg-purple-50 rounded-lg focus:ring-2 focus:ring-purple-500 font-medium text-sm"
            >
              <option value="all">📋 Tous les menus</option>
              {menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name}
                </option>
              ))}
            </select>
            
            {/* Sélecteur de département */}
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 border border-green-300 bg-green-50 rounded-lg focus:ring-2 focus:ring-green-500 font-medium text-sm"
            >
              <option value="all">🏢 Tous les départements</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>
            
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Toutes les catégories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setSelectedMonth('');
                setSelectedRestaurant('all');
                setSelectedMenu('all');
                setSelectedDepartment('all');
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition duration-200 flex items-center justify-center text-sm"
            >
              <FaFilter className="mr-2" /> Réinitialiser
            </button>
          </div>
        </div>

        {/* Liste des dépenses */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h4 className="font-semibold text-gray-800">
              Dépenses ({filteredExpenses.length})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  {!currentRestaurantId && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Restaurant</th>}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Menu</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Département</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fournisseur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(expense.date).toLocaleDateString('fr-FR')}
                    </td>
                    {!currentRestaurantId && (
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-blue-600">
                          {restaurants.find(r => r.id === expense.restaurantId)?.name || 'N/A'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                        {expense.invoiceNumber && (
                          <p className="text-xs text-gray-500">Facture: {expense.invoiceNumber}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {expense.menuId ? (
                        <span className="text-sm text-purple-600 font-medium">
                          {menus.find(m => m.id === expense.menuId)?.name || 'N/A'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {DEPARTMENTS.find(d => d.value === expense.department)?.label || '🏢 Général'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: getCategoryColor(expense.categoryId) }}
                      >
                        {getCategoryName(expense.categoryId)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        expense.type === 'fixed' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {expense.type === 'fixed' ? 'Fixe' : 'Variable'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {expense.amount.toLocaleString()} FCFA
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {expense.supplier || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditExpense(expense)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <FaEdit />
                        </button>
                        {(userRole === 'manager' || userRole === 'accountant' || (userRole === 'delivery_manager' && expense.department === 'livraison')) && (
                          <button
                            onClick={() => handleDeleteExpense(expense.id, expense)}
                            className="text-red-600 hover:text-red-800"
                            title={
                              userRole === 'manager' || userRole === 'accountant' 
                                ? 'Supprimer définitivement' 
                                : 'Demander l\'approbation pour supprimer'
                            }
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredExpenses.length === 0 && (
              <div className="text-center py-8">
                <FaReceipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">Aucune dépense trouvée</p>
              </div>
            )}
          </div>
        </div>

        {/* Catégories */}
        <div className="bg-white rounded-lg shadow p-4">
          <h4 className="font-semibold text-gray-800 mb-4">Catégories de dépenses</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div key={category.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <div>
                      <h5 className="font-medium text-gray-900">{category.name}</h5>
                      <p className="text-xs text-gray-500">
                        {category.type === 'fixed' ? 'Charge fixe' : 'Charge variable'}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <FaEdit />
                    </button>
                    {userRole !== 'accountant' && (
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </div>
                {category.description && (
                  <p className="text-sm text-gray-600 mt-2">{category.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-lg font-semibold mb-4">
                {modalType === 'expense' 
                  ? (selectedItem ? 'Modifier la dépense' : 'Nouvelle dépense')
                  : (selectedItem ? 'Modifier la catégorie' : 'Nouvelle catégorie')
                }
              </h3>

              {modalType === 'expense' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.description ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Facture d'électricité"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Montant (FCFA) *
                      </label>
                      <input
                        type="number"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.amount ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.date ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                    </div>
                  </div>

                  {expenseForm.department === 'livraison' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Moto (optionnel)</label>
                      <select
                        value={expenseForm.motorcycleId}
                        onChange={(e) => {
                          const motoId = e.target.value;
                          const moto = motorcycles.find(m => m.id === motoId);
                          setExpenseForm({ ...expenseForm, motorcycleId: motoId, delivererId: moto?.currentDelivererId || '' });
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Aucune</option>
                        {motorcycles.map((m) => (
                          <option key={m.id} value={m.id}>{m.registrationNumber ? `${m.registrationNumber} — ` : ''}{m.brand || 'Moto'}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {expenseForm.delivererId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Livreur associé</label>
                      <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700">
                        {deliverers.find(d => d.id === expenseForm.delivererId)?.name || expenseForm.delivererId}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Catégorie *
                    </label>
                    <select
                      value={expenseForm.categoryId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.categoryId ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Sélectionner une catégorie</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.type === 'fixed' ? 'Fixe' : 'Variable'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de charge
                    </label>
                    <select
                      value={expenseForm.type}
                      onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {EXPENSE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Menu
                      </label>
                      <select
                        value={expenseForm.menuId}
                        onChange={(e) => setExpenseForm({ ...expenseForm, menuId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Non spécifié</option>
                        {menus.map((menu) => (
                          <option key={menu.id} value={menu.id}>
                            {menu.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Département *
                      </label>
                      {userRole === 'delivery_manager' ? (
                        <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                          🚚 Livraison (Département fixe)
                        </div>
                      ) : (
                        <select
                          value={expenseForm.department}
                          onChange={(e) => setExpenseForm({ ...expenseForm, department: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                            errors.department ? 'border-red-500' : 'border-gray-300'
                          }`}
                        >
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept.value} value={dept.value}>
                              {dept.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        N° Facture
                      </label>
                      <input
                        type="text"
                        value={expenseForm.invoiceNumber}
                        onChange={(e) => setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: FAC-2024-001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fournisseur
                      </label>
                      <input
                        type="text"
                        value={expenseForm.supplier}
                        onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: EDF"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={expenseForm.notes}
                      onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Notes additionnelles..."
                      rows="3"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom de la catégorie *
                    </label>
                    <input
                      type="text"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Électricité"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de charge
                    </label>
                    <select
                      value={categoryForm.type}
                      onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {EXPENSE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Couleur
                    </label>
                    <div className="flex gap-2">
                      {CATEGORY_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setCategoryForm({ ...categoryForm, color })}
                          className={`w-8 h-8 rounded-full border-2 ${
                            categoryForm.color === color ? 'border-gray-800' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Description de la catégorie..."
                      rows="3"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedItem(null);
                    setErrors({});
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button
                  onClick={modalType === 'expense' ? handleCreateExpense : handleCreateCategory}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'En cours...' : (selectedItem ? 'Modifier' : 'Créer')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExpensesManager;
