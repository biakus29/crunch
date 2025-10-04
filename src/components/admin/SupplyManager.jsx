
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import InventoryManager from './InventoryManager';
import ProductionManager from './ProductionManager';
import SupplyReports from './SupplyReports';
import PurchaseListCreator from './PurchaseListCreator';
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
  FaBoxes,
  FaShoppingCart,
  FaClipboardList,
  FaCogs,
  FaChartLine,
  FaPlus,
  FaEdit,
  FaTrash,
  FaEye,
  FaCalendarAlt,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { hasPermission } from '../../utils/rolePermissions';

// Available unit options for ingredients (single choice)
const UNIT_OPTIONS = ['kg', 'g', 'L', 'mL', 'unité'];

const SupplyManager = ({ currentRestaurantId, userRole }) => {
  const [activeSection, setActiveSection] = useState('ingredients');
  const [ingredients, setIngredients] = useState([]);
  const [labels, setLabels] = useState([]);
  const [menus, setMenus] = useState([]);
  const [purchaseLists, setPurchaseLists] = useState([]);
  const [productions, setProductions] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [currentSpent, setCurrentSpent] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [ingredientForm, setIngredientForm] = useState({
    name: '',
    labelId: '',
    unit: '',
    unitPrice: null,
    menuIds: [],
  });

  const [purchaseForm, setPurchaseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    brands: [],
    items: [],
    total: 0,
  });

  const [labelForm, setLabelForm] = useState({
    name: '',
    description: '',
    ingredientIds: [],
  });

  const menuSections = [
    { id: 'ingredients', label: 'Ingrédients', icon: <FaBoxes /> },
    { id: 'purchases', label: 'Approvisionnement', icon: <FaShoppingCart /> },
    { id: 'inventory', label: 'Inventaires & Stocks', icon: <FaClipboardList /> },
    { id: 'production', label: 'Production', icon: <FaCogs /> },
    { id: 'reports', label: 'Rapports', icon: <FaChartLine /> },
  ];

  useEffect(() => {
    if (!currentRestaurantId) return;
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ingredientsSnap, labelsSnap, purchasesSnap, menusSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'ingredients'),
            where('restaurantId', '==', currentRestaurantId),
            orderBy('name')
          )
        ),
        getDocs(
          query(collection(db, 'ingredientLabels'), where('restaurantId', '==', currentRestaurantId))
        ),
        getDocs(
          query(
            collection(db, 'purchaseLists'),
            where('restaurantId', '==', currentRestaurantId),
            orderBy('date', 'desc')
          )
        ),
        getDocs(
          query(collection(db, 'menus'), where('restaurantId', '==', currentRestaurantId))
        ),
      ]);

      setIngredients(ingredientsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLabels(labelsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setPurchaseLists(purchasesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setMenus(menusSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      const totalSpent = purchasesSnap.docs.reduce(
        (sum, doc) => sum + (doc.data().total || 0),
        0
      );
      setCurrentSpent(totalSpent);
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
      setLoading(false);
    }
  };

  const handleCreateIngredient = async () => {
    try {
      const newErrors = {};
      if (!ingredientForm.name.trim()) newErrors.name = true;
      if (!ingredientForm.unit) newErrors.unit = true;
      setErrors(newErrors);
      if (Object.keys(newErrors).length) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      setIsSubmitting(true);
      await createIngredient();
      toast.success('Ingrédient créé avec succès');
    } catch (error) {
      console.error('Erreur création ingrédient:', error);
      toast.error('Erreur lors de la création de l\'ingrédient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateIngredient = async () => {
    try {
      const newErrors = {};
      if (!ingredientForm.name.trim()) newErrors.name = true;
      if (!ingredientForm.unit) newErrors.unit = true;
      setErrors(newErrors);
      if (Object.keys(newErrors).length) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      setIsSubmitting(true);
      const unitsPersisted = ingredientForm.unit
        ? [{ name: ingredientForm.unit, price: ingredientForm.unitPrice || 0 }]
        : [];
      await updateDoc(doc(db, 'ingredients', selectedItem.id), {
        name: ingredientForm.name.trim(),
        labelId: ingredientForm.labelId || '',
        units: unitsPersisted,
        menus: ingredientForm.menuIds || [],
        updatedAt: serverTimestamp(),
      });
      setShowModal(false);
      setIngredientForm({ name: '', labelId: '', unit: '', unitPrice: null, menuIds: [] });
      setSelectedItem(null);
      loadData();
      toast.success('Ingrédient mis à jour avec succès');
    } catch (error) {
      console.error('Erreur mise à jour ingrédient:', error);
      toast.error('Erreur lors de la mise à jour de l\'ingrédient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIngredient = async (ingredientId) => {
    try {
      setIsSubmitting(true);
      await deleteDoc(doc(db, 'ingredients', ingredientId));
      setShowModal(false);
      setSelectedItem(null);
      loadData();
      toast.success('Ingrédient supprimé avec succès');
    } catch (error) {
      console.error('Erreur suppression ingrédient:', error);
      toast.error('Erreur lors de la suppression de l\'ingrédient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createIngredient = async () => {
    const unitsPersisted = ingredientForm.unit
      ? [{ name: ingredientForm.unit, price: ingredientForm.unitPrice || 0 }]
      : [];
    await addDoc(collection(db, 'ingredients'), {
      name: ingredientForm.name.trim(),
      labelId: ingredientForm.labelId || '',
      units: unitsPersisted,
      menus: ingredientForm.menuIds || [],
      restaurantId: currentRestaurantId,
      createdAt: serverTimestamp(),
    });
    setShowModal(false);
    setIngredientForm({ name: '', labelId: '', unit: '', unitPrice: null, menuIds: [] });
    loadData();
  };

  const createLabel = async () => {
    try {
      const newErrors = {};
      if (!labelForm.name.trim()) newErrors.name = true;
      if (labelForm.ingredientIds.length === 0) newErrors.ingredientIds = true;
      setErrors(newErrors);
      if (Object.keys(newErrors).length) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      setIsSubmitting(true);
      const ref = await addDoc(collection(db, 'ingredientLabels'), {
        name: labelForm.name.trim(),
        description: labelForm.description?.trim() || '',
        restaurantId: currentRestaurantId,
        createdAt: serverTimestamp(),
      });

      await Promise.all(
        labelForm.ingredientIds.map((ingId) =>
          updateDoc(doc(db, 'ingredients', ingId), {
            labelId: ref.id,
            updatedAt: serverTimestamp(),
          })
        )
      );

      setShowModal(false);
      setLabelForm({ name: '', description: '', ingredientIds: [] });
      loadData();
      toast.success('Label créé avec succès');
    } catch (error) {
      console.error('Erreur création label:', error);
      toast.error('Erreur lors de la création du label');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLabel = async () => {
    try {
      const newErrors = {};
      if (!labelForm.name.trim()) newErrors.name = true;
      if (labelForm.ingredientIds.length === 0) newErrors.ingredientIds = true;
      setErrors(newErrors);
      if (Object.keys(newErrors).length) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      setIsSubmitting(true);
      await updateDoc(doc(db, 'ingredientLabels', selectedItem.id), {
        name: labelForm.name.trim(),
        description: labelForm.description?.trim() || '',
        updatedAt: serverTimestamp(),
      });

      const currentIngredientIds = ingredients
        .filter((ing) => ing.labelId === selectedItem.id)
        .map((ing) => ing.id);
      const ingredientsToAdd = labelForm.ingredientIds.filter(
        (id) => !currentIngredientIds.includes(id)
      );
      const ingredientsToRemove = currentIngredientIds.filter(
        (id) => !labelForm.ingredientIds.includes(id)
      );

      await Promise.all([
        ...ingredientsToAdd.map((ingId) =>
          updateDoc(doc(db, 'ingredients', ingId), {
            labelId: selectedItem.id,
            updatedAt: serverTimestamp(),
          })
        ),
        ...ingredientsToRemove.map((ingId) =>
          updateDoc(doc(db, 'ingredients', ingId), {
            labelId: '',
            updatedAt: serverTimestamp(),
          })
        ),
      ]);

      setShowModal(false);
      setLabelForm({ name: '', description: '', ingredientIds: [] });
      setSelectedItem(null);
      loadData();
      toast.success('Label mis à jour avec succès');
    } catch (error) {
      console.error('Erreur mise à jour label:', error);
      toast.error('Erreur lors de la mise à jour du label');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLabel = async (labelId) => {
    try {
      setIsSubmitting(true);
      const ingredientsWithLabel = ingredients.filter((ing) => ing.labelId === labelId);
      await Promise.all(
        ingredientsWithLabel.map((ing) =>
          updateDoc(doc(db, 'ingredients', ing.id), {
            labelId: '',
            updatedAt: serverTimestamp(),
          })
        )
      );
      await deleteDoc(doc(db, 'ingredientLabels', labelId));
      setShowModal(false);
      setSelectedItem(null);
      loadData();
      toast.success('Label supprimé avec succès');
    } catch (error) {
      console.error('Erreur suppression label:', error);
      toast.error('Erreur lors de la suppression du label');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePurchaseList = async (purchaseId) => {
    try {
      setIsSubmitting(true);
      await deleteDoc(doc(db, 'purchaseLists', purchaseId));
      setShowModal(false);
      setSelectedItem(null);
      loadData();
      toast.success('Liste d\'achat supprimée avec succès');
    } catch (error) {
      console.error('Erreur suppression liste achat:', error);
      toast.error('Erreur lors de la suppression de la liste d\'achat');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createPurchaseList = async () => {
    try {
      const total = purchaseForm.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      await addDoc(collection(db, 'purchaseLists'), {
        ...purchaseForm,
        total,
        restaurantId: currentRestaurantId,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setShowModal(false);
      setPurchaseForm({ date: new Date().toISOString().split('T')[0], brands: [], items: [], total: 0 });
      loadData();
      toast.success('Liste d\'achat créée avec succès');
    } catch (error) {
      console.error('Erreur création liste achat:', error);
      toast.error('Erreur lors de la création de la liste d\'achat');
    }
  };

  const renderIngredientsSection = () => (
    <div className="space-y-4">
      <div className="flex flex-col justify-between items-start gap-2 sm:flex-row sm:items-center">
        <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">Gestion des Ingrédients</h3>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            onClick={() => {
              if (ingredients.length) {
                setModalType('label');
                setShowModal(true);
                setLabelForm({ name: '', description: '', ingredientIds: [] });
                setSelectedItem(null);
              }
            }}
            disabled={!ingredients.length}
            className={`flex-1 px-3 py-1.5 rounded-lg text-white text-xs sm:px-4 sm:py-2 sm:text-sm ${
              ingredients.length ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
            } transition duration-200`}
          >
            <FaPlus className="inline mr-1 sm:mr-2" /> Nouveau Label
          </button>
          <button
            onClick={() => {
              setModalType('ingredient');
              setShowModal(true);
              setIngredientForm({ name: '', labelId: '', unit: '', unitPrice: null, menuIds: [] });
              setSelectedItem(null);
            }}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition duration-200 sm:px-4 sm:py-2 sm:text-sm"
          >
            <FaPlus className="inline mr-1 sm:mr-2" /> Nouvel Ingrédient
          </button>
        </div>
      </div>

      {/* Labels */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <h4 className="font-semibold text-gray-800 mb-2 text-base sm:text-lg">Labels d'Ingrédients</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 sm:gap-3">
          {labels.map((label) => (
            <div key={label.id} className="p-2 border rounded-lg sm:p-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-800 text-sm sm:text-base">{label.name}</span>
                <div className="space-x-1 sm:space-x-2">
                  <button
                    onClick={() => {
                      setModalType('edit-label');
                      setShowModal(true);
                      setSelectedItem(label);
                      setLabelForm({
                        name: label.name,
                        description: label.description || '',
                        ingredientIds: ingredients
                          .filter((ing) => ing.labelId === label.id)
                          .map((ing) => ing.id),
                      });
                    }}
                    className="text-blue-600 hover:text-blue-800 text-base sm:text-lg"
                    aria-label={`Modifier ${label.name}`}
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => {
                      setModalType('delete-label');
                      setShowModal(true);
                      setSelectedItem(label);
                    }}
                    className="text-red-600 hover:text-red-800 text-base sm:text-lg"
                    aria-label={`Supprimer ${label.name}`}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 sm:text-sm">{label.description || 'Aucune description'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <h4 className="font-semibold text-gray-800 mb-2 text-base sm:text-lg">Liste des Ingrédients</h4>
        {/* Mobile: Cards */}
        <div className="space-y-2 md:hidden">
          {ingredients.map((ingredient) => (
            <div key={ingredient.id} className="border rounded-lg p-2 sm:p-3">
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="font-semibold text-sm text-gray-800">{ingredient.name}</h5>
                  <p className="text-xs text-gray-500">
                    {labels.find((l) => l.id === ingredient.labelId)?.name || 'Sans label'}
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-base">
                  <button
                    onClick={() => {
                      setModalType('edit-ingredient');
                      setShowModal(true);
                      setSelectedItem(ingredient);
                      setIngredientForm({
                        name: ingredient.name,
                        labelId: ingredient.labelId || '',
                        unit: ingredient.units?.[0]?.name || '',
                        unitPrice: ingredient.units?.[0]?.price || null,
                        menuIds: ingredient.menus || [],
                      });
                    }}
                    className="text-blue-600 hover:text-blue-800"
                    aria-label={`Modifier ${ingredient.name}`}
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => {
                      setModalType('delete-ingredient');
                      setShowModal(true);
                      setSelectedItem(ingredient);
                    }}
                    className="text-red-600 hover:text-red-800"
                    aria-label={`Supprimer ${ingredient.name}`}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
              <div className="mt-1 text-xs sm:text-sm">
                <p className="text-gray-600">
                  <span className="text-gray-500">Unités: </span>
                  {ingredient.units?.map((u) => u.name).join(', ') || '-'}
                </p>
                <p className="text-gray-600">
                  <span className="text-gray-500">Menus: </span>
                  {ingredient.menus?.length || 0}
                </p>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop/Tablets */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Nom</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Label</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Unités</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Menus</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ingredients.map((ingredient) => (
                <tr key={ingredient.id}>
                  <td className="px-4 py-2">{ingredient.name}</td>
                  <td className="px-4 py-2">
                    {labels.find((l) => l.id === ingredient.labelId)?.name || '-'}
                  </td>
                  <td className="px-4 py-2">
                    {ingredient.units?.map((u) => u.name).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-sm text-gray-600">
                      {ingredient.menus?.length || 0} menu(s)
                    </span>
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => {
                        setModalType('edit-ingredient');
                        setShowModal(true);
                        setSelectedItem(ingredient);
                        setIngredientForm({
                          name: ingredient.name,
                          labelId: ingredient.labelId || '',
                          unit: ingredient.units?.[0]?.name || '',
                          unitPrice: ingredient.units?.[0]?.price || null,
                          menuIds: ingredient.menus || [],
                        });
                      }}
                      className="text-blue-600 hover:text-blue-800"
                      aria-label={`Modifier ${ingredient.name}`}
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => {
                        setModalType('delete-ingredient');
                        setShowModal(true);
                        setSelectedItem(ingredient);
                      }}
                      className="text-red-600 hover:text-red-800"
                      aria-label={`Supprimer ${ingredient.name}`}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPurchasesSection = () => (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col justify-between items-start gap-2 sm:flex-row sm:items-center">
        <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">Approvisionnement</h3>
        <button
          onClick={() => {
            setModalType('purchase');
            setShowModal(true);
          }}
          className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
        >
          <FaPlus className="inline mr-1 text-xs sm:mr-2 sm:text-sm" /> Nouvelle Liste d'Achat
        </button>
      </div>

      {/* Budget Overview - Visible seulement pour les rôles avec accès aux finances */}
      {hasPermission(userRole, 'purchases', 'viewFinances') && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <h4 className="font-medium text-gray-700 text-xs sm:text-sm">Budget Mensuel</h4>
            <p className="text-base font-bold text-blue-600 mt-1 sm:text-lg md:text-xl">
              {monthlyBudget.toLocaleString()} FCFA
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <h4 className="font-medium text-gray-700 text-xs sm:text-sm">Dépensé ce Mois</h4>
            <p className="text-base font-bold text-green-600 mt-1 sm:text-lg md:text-xl">
              {currentSpent.toLocaleString()} FCFA
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <h4 className="font-medium text-gray-700 text-xs sm:text-sm">Restant</h4>
            <p className="text-base font-bold text-orange-600 mt-1 sm:text-lg md:text-xl">
              {(monthlyBudget - currentSpent).toLocaleString()} FCFA
            </p>
          </div>
        </div>
      )}

      {/* Purchase Lists */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <h4 className="font-semibold text-gray-800 mb-2 text-base sm:text-lg">Listes d'Achats</h4>
        {/* Mobile: Cards */}
        <div className="space-y-2 md:hidden">
          {purchaseLists.map((list) => (
            <div key={list.id} className="border rounded-lg p-2 sm:p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 sm:text-sm">{list.date}</p>
                  <h5 className="font-semibold text-sm mt-0.5 truncate sm:text-base">
                    {list.brands?.join(', ') || 'Sans marque'}
                  </h5>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap sm:px-2 sm:py-1 sm:text-xs ${
                    list.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : list.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {list.status}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <div className="text-xs sm:text-sm">
                  <span className="text-gray-500">Total: </span>
                  <span className="font-semibold text-gray-900">{list.total?.toLocaleString()} FCFA</span>
                </div>
                <div className="flex items-center space-x-2 text-base sm:text-lg">
                  <button
                    className="text-blue-600 hover:text-blue-800"
                    aria-label={`Voir ${list.date}`}
                  >
                    <FaEye />
                  </button>
                  <button
                    className="text-green-600 hover:text-green-800"
                    aria-label={`Modifier ${list.date}`}
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => {
                      setModalType('delete-purchase');
                      setShowModal(true);
                      setSelectedItem(list);
                    }}
                    className="text-red-600 hover:text-red-800"
                    aria-label={`Supprimer ${list.date}`}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop/Tablets: Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Date</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Marques</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Montant Total</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Statut</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {purchaseLists.map((list) => (
                <tr key={list.id}>
                  <td className="px-3 py-2 sm:px-4 sm:py-3">{list.date}</td>
                  <td
                    className="px-3 py-2 truncate max-w-[14rem] sm:px-4 sm:py-3"
                    title={list.brands?.join(', ') || '-'}
                  >
                    {list.brands?.join(', ') || '-'}
                  </td>
                  <td className="px-3 py-2 font-semibold sm:px-4 sm:py-3">{list.total?.toLocaleString()} FCFA</td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium sm:px-3 sm:py-1.5 sm:text-sm ${
                        list.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : list.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {list.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 space-x-1 sm:px-4 sm:py-3 sm:space-x-2">
                    <button
                      className="text-blue-600 hover:text-blue-800 text-base sm:text-lg"
                      aria-label={`Voir ${list.date}`}
                    >
                      <FaEye />
                    </button>
                    <button
                      className="text-green-600 hover:text-green-800 text-base sm:text-lg"
                      aria-label={`Modifier ${list.date}`}
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => {
                        setModalType('delete-purchase');
                        setShowModal(true);
                        setSelectedItem(list);
                      }}
                      className="text-red-600 hover:text-red-800 text-base sm:text-lg"
                      aria-label={`Supprimer ${list.date}`}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-4 text-center sm:p-6">
        <FaShoppingCart className="animate-spin h-5 w-5 mx-auto text-blue-600 sm:h-6 sm:w-6" />
        <span className="text-gray-600 text-sm sm:text-base">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      {/* Navigation */}
      <div className="mb-3 sm:mb-4">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 overflow-x-auto no-scrollbar">
          {menuSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors whitespace-nowrap text-xs sm:space-x-1.5 sm:px-3 sm:py-1.5 md:px-4 md:py-2 md:text-base ${
                activeSection === section.id
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {section.icon}
              <span className="truncate max-w-[6rem] sm:max-w-[9rem] md:max-w-none">{section.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        {activeSection === 'ingredients' && renderIngredientsSection()}
        {activeSection === 'purchases' && renderPurchasesSection()}
        {activeSection === 'inventory' && <InventoryManager currentRestaurantId={currentRestaurantId} />}
        {activeSection === 'production' && <ProductionManager currentRestaurantId={currentRestaurantId} />}
        {activeSection === 'reports' && <SupplyReports currentRestaurantId={currentRestaurantId} />}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showModal && modalType === 'purchase' && (
          <PurchaseListCreator
            currentRestaurantId={currentRestaurantId}
            onClose={() => {
              setShowModal(false);
              setModalType('');
            }}
            onSave={() => loadData()}
            monthlyBudget={monthlyBudget}
            currentSpent={currentSpent}
          />
        )}
        {showModal && modalType !== 'purchase' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-lg p-4 max-w-md w-full mx-4 sm:p-6"
            >
              {modalType === 'ingredient' || modalType === 'edit-ingredient' ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 sm:text-xl sm:mb-6">
                    {modalType === 'ingredient' ? 'Ajouter un nouvel ingrédient' : 'Modifier un ingrédient'}
                  </h3>
                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <label
                        htmlFor="ingredient-name"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Nom de l'ingrédient <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="ingredient-name"
                        type="text"
                        placeholder="Ex. Tomates"
                        value={ingredientForm.name}
                        onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                        className={`w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm sm:px-4 sm:py-2 ${
                          errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        aria-required="true"
                        aria-describedby="name-error"
                      />
                      {errors.name && (
                        <p id="name-error" className="text-xs text-red-500 mt-1 sm:text-sm">
                          Le nom de l'ingrédient est requis.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                        Unité de mesure <span className="text-red-500">*</span>
                      </label>
                      <div
                        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                        role="radiogroup"
                        aria-labelledby="units-label"
                      >
                        {UNIT_OPTIONS.map((unit) => (
                          <label
                            key={unit}
                            htmlFor={`unit-${unit}`}
                            className={`flex items-center gap-1 border rounded-md px-2 py-1.5 cursor-pointer text-xs sm:gap-2 sm:px-3 sm:py-2 sm:text-sm ${
                              ingredientForm.unit === unit
                                ? 'border-blue-500 ring-1 ring-blue-200'
                                : 'border-gray-200'
                            }`}
                          >
                            <input
                              type="radio"
                              id={`unit-${unit}`}
                              name="unit"
                              value={unit}
                              checked={ingredientForm.unit === unit}
                              onChange={() => setIngredientForm({ ...ingredientForm, unit })}
                              className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 sm:h-4 sm:w-4"
                            />
                            <span className="text-gray-700">{unit}</span>
                          </label>
                        ))}
                      </div>
                      {errors.unit && (
                        <p id="units-error" className="text-xs text-red-500 mt-1 sm:text-sm">
                          Veuillez choisir une unité de mesure.
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="unit-price"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Prix unitaire (optionnel)
                      </label>
                      <div className="relative">
                        <input
                          id="unit-price"
                          type="number"
                          placeholder="Ex. 2.50"
                          value={ingredientForm.unitPrice || ''}
                          onChange={(e) =>
                            setIngredientForm({
                              ...ingredientForm,
                              unitPrice: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                          step="0.01"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm sm:px-4 sm:py-2"
                          aria-describedby="price-hint"
                        />
                        <span className="absolute right-2 top-1.5 text-gray-500 text-xs sm:right-3 sm:top-2.5 sm:text-sm">FCFA</span>
                      </div>
                      <p id="price-hint" className="text-xs text-gray-500 mt-1 sm:text-sm">
                        Entrez le prix par unité.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                        Menus associés
                      </label>
                      <div
                        className="space-y-1 max-h-32 overflow-y-auto sm:space-y-2 sm:max-h-40"
                        role="group"
                        aria-labelledby="menus-label"
                      >
                        {menus.map((menu) => (
                          <div key={menu.id} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`menu-${menu.id}`}
                              checked={ingredientForm.menuIds.includes(menu.id)}
                              onChange={(e) => {
                                const updatedMenuIds = e.target.checked
                                  ? [...ingredientForm.menuIds, menu.id]
                                  : ingredientForm.menuIds.filter((id) => id !== menu.id);
                                setIngredientForm({ ...ingredientForm, menuIds: updatedMenuIds });
                              }}
                              className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded sm:h-4 sm:w-4"
                              aria-labelledby={`menu-label-${menu.id}`}
                            />
                            <label
                              htmlFor={`menu-${menu.id}`}
                              id={`menu-label-${menu.id}`}
                              className="ml-1 text-xs text-gray-700 sm:ml-2 sm:text-sm"
                            >
                              {menu.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="label-select"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Label
                      </label>
                      <select
                        id="label-select"
                        value={ingredientForm.labelId}
                        onChange={(e) =>
                          setIngredientForm({ ...ingredientForm, labelId: e.target.value })
                        }
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm sm:px-4 sm:py-2"
                        aria-describedby="label-hint"
                      >
                        <option value="">Sélectionner un label</option>
                        {labels.map((label) => (
                          <option key={label.id} value={label.id}>
                            {label.name}
                          </option>
                        ))}
                      </select>
                      <p id="label-hint" className="text-xs text-gray-500 mt-1 sm:text-sm">
                        Sélectionnez un label (ex. Bio, Local).
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-4 sm:space-x-3 sm:mt-8">
                    <button
                      onClick={() =>
                        setIngredientForm({
                          name: '',
                          unit: '',
                          unitPrice: null,
                          menuIds: [],
                          labelId: '',
                        })
                      }
                      className="px-3 py-1.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition duration-200 text-xs sm:px-4 sm:py-2 sm:text-sm"
                      aria-label="Réinitialiser le formulaire"
                    >
                      Réinitialiser
                    </button>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedItem(null);
                        setErrors({});
                      }}
                      className="px-3 py-1.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition duration-200 text-xs sm:px-4 sm:py-2 sm:text-sm"
                      aria-label="Annuler"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={modalType === 'ingredient' ? handleCreateIngredient : handleUpdateIngredient}
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 flex items-center text-xs sm:px-4 sm:py-2 sm:text-sm ${
                        isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      aria-label={modalType === 'ingredient' ? 'Créer l\'ingrédient' : 'Modifier l\'ingrédient'}
                    >
                      {isSubmitting ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 mr-1 text-white sm:h-5 sm:w-5 sm:mr-2"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          {modalType === 'ingredient' ? 'Création...' : 'Mise à jour...'}
                        </>
                      ) : (
                        modalType === 'ingredient' ? 'Créer' : 'Modifier'
                      )}
                    </button>
                  </div>
                </div>
              ) : modalType === 'label' || modalType === 'edit-label' ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 sm:text-xl sm:mb-6">
                    {modalType === 'label' ? 'Nouveau Label' : 'Modifier le Label'}
                  </h3>
                  {!ingredients.length && modalType === 'label' && (
                    <div className="mb-3 text-xs text-red-600 sm:mb-4 sm:text-sm">
                      Créez d'abord au moins un ingrédient.
                    </div>
                  )}
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label
                        htmlFor="label-name"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Nom du label <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="label-name"
                        type="text"
                        placeholder="Ex. Bio"
                        value={labelForm.name}
                        onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })}
                        className={`w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm sm:px-4 sm:py-2 ${
                          errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        aria-required="true"
                        aria-describedby="label-name-error"
                      />
                      {errors.name && (
                        <p id="label-name-error" className="text-xs text-red-500 mt-1 sm:text-sm">
                          Le nom du label est requis.
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="label-description"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Description
                      </label>
                      <textarea
                        id="label-description"
                        placeholder="Description du label"
                        value={labelForm.description}
                        onChange={(e) => setLabelForm({ ...labelForm, description: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm sm:px-4 sm:py-2"
                        rows="2" // Reduced for mobile
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                        Ingrédients associés <span className="text-red-500">*</span>
                      </label>
                      <div
                        className="max-h-40 overflow-auto border rounded-lg sm:max-h-56"
                        role="group"
                        aria-labelledby="ingredients-label"
                      >
                        {ingredients.map((ing) => (
                          <label
                            key={ing.id}
                            className="flex items-center gap-1 px-3 py-1.5 border-b last:border-b-0 text-sm sm:gap-2 sm:px-4 sm:py-2"
                          >
                            <input
                              type="checkbox"
                              checked={labelForm.ingredientIds.includes(ing.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setLabelForm((prev) => ({
                                  ...prev,
                                  ingredientIds: checked
                                    ? [...prev.ingredientIds, ing.id]
                                    : prev.ingredientIds.filter((id) => id !== ing.id),
                                }));
                              }}
                              className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded sm:h-4 sm:w-4"
                            />
                            <span className="text-gray-700 text-xs sm:text-sm">{ing.name}</span>
                          </label>
                        ))}
                      </div>
                      {errors.ingredientIds && (
                        <p className="text-xs text-red-500 mt-1 sm:text-sm">
                          Sélectionnez au moins un ingrédient.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-4 sm:space-x-3 sm:mt-6">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setLabelForm({ name: '', description: '', ingredientIds: [] });
                        setSelectedItem(null);
                        setErrors({});
                      }}
                      className="px-3 py-1.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition duration-200 text-xs sm:px-4 sm:py-2 sm:text-sm"
                      aria-label="Annuler"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={modalType === 'label' ? createLabel : handleUpdateLabel}
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 flex items-center text-xs sm:px-4 sm:py-2 sm:text-sm ${
                        isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      aria-label={modalType === 'label' ? 'Créer le label' : 'Modifier le label'}
                    >
                      {isSubmitting ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 mr-1 text-white sm:h-5 sm:w-5 sm:mr-2"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          {modalType === 'label' ? 'Création...' : 'Mise à jour...'}
                        </>
                      ) : (
                        modalType === 'label' ? 'Créer' : 'Modifier'
                      )}
                    </button>
                  </div>
                </div>
              ) : modalType === 'delete-ingredient' ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:text-xl sm:mb-4">
                    Confirmer la suppression
                  </h3>
                  <p className="text-gray-600 mb-3 text-sm sm:mb-4 sm:text-base">
                    Voulez-vous vraiment supprimer l'ingrédient{' '}
                    <span className="font-semibold">{selectedItem?.name}</span> ? Cette action est
                    irréversible.
                  </p>
                  <div className="flex justify-end space-x-2 sm:space-x-3">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedItem(null);
                      }}
                      className="px-3 py-1.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition duration-200 text-xs sm:px-4 sm:py-2 sm:text-sm"
                      aria-label="Annuler"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleDeleteIngredient(selectedItem.id)}
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 flex items-center text-xs sm:px-4 sm:py-2 sm:text-sm ${
                        isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      aria-label={`Supprimer ${selectedItem?.name}`}
                    >
                      {isSubmitting ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 mr-1 text-white sm:h-5 sm:w-5 sm:mr-2"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Suppression...
                        </>
                      ) : (
                        'Supprimer'
                      )}
                    </button>
                  </div>
                </div>
              ) : modalType === 'delete-label' ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:text-xl sm:mb-4">
                    Confirmer la suppression
                  </h3>
                  <p className="text-gray-600 mb-3 text-sm sm:mb-4 sm:text-base">
                    Voulez-vous vraiment supprimer le label{' '}
                    <span className="font-semibold">{selectedItem?.name}</span> ? Les ingrédients associés
                    perdront ce label. Cette action est irréversible.
                  </p>
                  <div className="flex justify-end space-x-2 sm:space-x-3">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedItem(null);
                      }}
                      className="px-3 py-1.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition duration-200 text-xs sm:px-4 sm:py-2 sm:text-sm"
                      aria-label="Annuler"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleDeleteLabel(selectedItem.id)}
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 flex items-center text-xs sm:px-4 sm:py-2 sm:text-sm ${
                        isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      aria-label={`Supprimer ${selectedItem?.name}`}
                    >
                      {isSubmitting ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 mr-1 text-white sm:h-5 sm:w-5 sm:mr-2"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Suppression...
                        </>
                      ) : (
                        'Supprimer'
                      )}
                    </button>
                  </div>
                </div>
              ) : modalType === 'delete-purchase' ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 sm:text-xl sm:mb-4">
                    Confirmer la suppression
                  </h3>
                  <p className="text-gray-600 mb-3 text-sm sm:mb-4 sm:text-base">
                    Voulez-vous vraiment supprimer la liste d'achat du{' '}
                    <span className="font-semibold">{selectedItem?.date}</span> ? Cette action est
                    irréversible.
                  </p>
                  <div className="flex justify-end space-x-2 sm:space-x-3">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedItem(null);
                      }}
                      className="px-3 py-1.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition duration-200 text-xs sm:px-4 sm:py-2 sm:text-sm"
                      aria-label="Annuler"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleDeletePurchaseList(selectedItem.id)}
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 flex items-center text-xs sm:px-4 sm:py-2 sm:text-sm ${
                        isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      aria-label={`Supprimer ${selectedItem?.date}`}
                    >
                      {isSubmitting ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 mr-1 text-white sm:h-5 sm:w-5 sm:mr-2"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Suppression...
                        </>
                      ) : (
                        'Supprimer'
                      )}
                    </button>
                  </div>
                </div>
              ) : modalType === 'budget' && hasPermission(userRole, 'purchases', 'viewFinances') ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 sm:text-xl sm:mb-6">Définir le Budget Mensuel</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label
                        htmlFor="budget-amount"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Budget Mensuel (FCFA) <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="budget-amount"
                        type="number"
                        placeholder="Ex. 1000000"
                        value={monthlyBudget || ''}
                        onChange={(e) =>
                          setMonthlyBudget(e.target.value ? parseFloat(e.target.value) : 0)
                        }
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm sm:px-4 sm:py-2"
                        aria-required="true"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-4 sm:space-x-3 sm:mt-6">
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedItem(null);
                      }}
                      className="px-3 py-1.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition duration-200 text-xs sm:px-4 sm:py-2 sm:text-sm"
                      aria-label="Annuler"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        toast.success('Budget mensuel mis à jour');
                      }}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 text-xs sm:px-4 sm:py-2 sm:text-sm"
                      aria-label="Enregistrer le budget"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupplyManager;
