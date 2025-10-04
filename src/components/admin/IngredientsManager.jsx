import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
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
  FaPlus,
  FaEdit,
  FaTrash,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const UNIT_OPTIONS = ['kg', 'g', 'L', 'mL', 'unité'];

const IngredientsManager = ({ currentRestaurantId }) => {
  const [ingredients, setIngredients] = useState([]);
  const [labels, setLabels] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [ingredientForm, setIngredientForm] = useState({
    name: '',
    labelId: '',
    unit: '',
    unitPrice: null,
    menuIds: [],
  });

  const [labelForm, setLabelForm] = useState({
    name: '',
    description: '',
    ingredientIds: [],
  });

  useEffect(() => {
    if (!currentRestaurantId) return;
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ingredientsSnap, labelsSnap, menusSnap] = await Promise.all([
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
          query(collection(db, 'menus'), where('restaurantId', '==', currentRestaurantId))
        ),
      ]);

      setIngredients(ingredientsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLabels(labelsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setMenus(menusSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
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
      if (selectedItem) {
        await updateIngredient();
        toast.success('Ingrédient modifié avec succès');
      } else {
        await createIngredient();
        toast.success('Ingrédient créé avec succès');
      }
    } catch (error) {
      console.error('Erreur ingrédient:', error);
      toast.error(`Erreur lors de ${selectedItem ? 'la modification' : 'la création'} de l'ingrédient`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateIngredient = async () => {
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

  const handleEditIngredient = (ingredient) => {
    setSelectedItem(ingredient);
    setIngredientForm({
      name: ingredient.name,
      labelId: ingredient.labelId || '',
      unit: ingredient.units?.[0]?.name || '',
      unitPrice: ingredient.units?.[0]?.price || null,
      menuIds: ingredient.menus || [],
    });
    setModalType('ingredient');
    setShowModal(true);
  };

  const handleDeleteIngredient = async (ingredientId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet ingrédient ?')) return;
    
    try {
      await deleteDoc(doc(db, 'ingredients', ingredientId));
      toast.success('Ingrédient supprimé avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur suppression ingrédient:', error);
      toast.error('Erreur lors de la suppression de l\'ingrédient');
    }
  };

  const handleEditLabel = (label) => {
    setSelectedItem(label);
    setLabelForm({
      name: label.name,
      description: label.description || '',
      ingredientIds: label.ingredientIds || [],
    });
    setModalType('label');
    setShowModal(true);
  };

  const handleDeleteLabel = async (labelId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce label ?')) return;
    
    try {
      await deleteDoc(doc(db, 'ingredientLabels', labelId));
      toast.success('Label supprimé avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur suppression label:', error);
      toast.error('Erreur lors de la suppression du label');
    }
  };

  const handleCreateLabel = async () => {
    try {
      const newErrors = {};
      if (!labelForm.name.trim()) newErrors.name = true;
      setErrors(newErrors);
      if (Object.keys(newErrors).length) {
        toast.error('Veuillez remplir le nom du label');
        return;
      }

      setIsSubmitting(true);
      if (selectedItem) {
        await updateLabel();
        toast.success('Label modifié avec succès');
      } else {
        await createLabel();
        toast.success('Label créé avec succès');
      }
    } catch (error) {
      console.error('Erreur label:', error);
      toast.error(`Erreur lors de ${selectedItem ? 'la modification' : 'la création'} du label`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const createLabel = async () => {
    await addDoc(collection(db, 'ingredientLabels'), {
      name: labelForm.name.trim(),
      description: labelForm.description.trim(),
      ingredientIds: labelForm.ingredientIds || [],
      restaurantId: currentRestaurantId,
      createdAt: serverTimestamp(),
    });
    setShowModal(false);
    setLabelForm({ name: '', description: '', ingredientIds: [] });
    loadData();
  };

  const updateLabel = async () => {
    await updateDoc(doc(db, 'ingredientLabels', selectedItem.id), {
      name: labelForm.name.trim(),
      description: labelForm.description.trim(),
      ingredientIds: labelForm.ingredientIds || [],
      updatedAt: serverTimestamp(),
    });
    setShowModal(false);
    setLabelForm({ name: '', description: '', ingredientIds: [] });
    setSelectedItem(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="p-4 text-center sm:p-6">
        <FaBoxes className="animate-spin h-5 w-5 mx-auto text-blue-600 sm:h-6 sm:w-6" />
        <span className="text-gray-600 text-sm sm:text-base">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:justify-between sm:items-center">
        <h3 className="text-xl font-bold text-gray-800 sm:text-2xl">Gestion des Ingrédients</h3>
        <div className="flex gap-2">
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
            className={`flex-1 px-3 py-2 rounded-lg text-white text-sm font-medium sm:flex-none sm:px-4 sm:py-2.5 ${
              ingredients.length ? 'bg-green-600 active:bg-green-700' : 'bg-gray-300'
            }`}
          >
            <FaPlus className="inline mr-1" /> Label
          </button>
          <button
            onClick={() => {
              setModalType('ingredient');
              setShowModal(true);
              setIngredientForm({ name: '', labelId: '', unit: '', unitPrice: null, menuIds: [] });
              setSelectedItem(null);
            }}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium active:bg-blue-700 sm:flex-none sm:px-4 sm:py-2.5"
          >
            <FaPlus className="inline mr-1" /> Ingrédient
          </button>
        </div>
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3 mb-4 sm:p-4">
          <h4 className="font-semibold text-base text-gray-800 mb-3 sm:text-lg">Labels</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {labels.map((label) => (
              <div key={label.id} className="p-3 border rounded-lg">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-gray-800">{label.name}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEditLabel(label)}
                      className="text-blue-600 active:text-blue-800"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      onClick={() => handleDeleteLabel(label.id)}
                      className="text-red-600 active:text-red-800"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                {label.description && (
                  <p className="text-sm text-gray-600">{label.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <h4 className="font-semibold text-base text-gray-800 mb-3 sm:text-lg">Ingrédients ({ingredients.length})</h4>
        
        {/* Mobile View */}
        <div className="space-y-2 lg:hidden">
          {ingredients.map((ingredient) => (
            <div key={ingredient.id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h5 className="font-semibold text-gray-800">{ingredient.name}</h5>
                  <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                    <p>{labels.find((l) => l.id === ingredient.labelId)?.name || 'Sans label'}</p>
                    <p>{ingredient.unit}{ingredient.unitPrice ? ` • ${ingredient.unitPrice} FCFA` : ''}</p>
                  </div>
                </div>
                <div className="flex gap-2 ml-2">
                  <button 
                    onClick={() => handleEditIngredient(ingredient)}
                    className="text-blue-600 active:text-blue-800 p-1"
                  >
                    <FaEdit />
                  </button>
                  <button 
                    onClick={() => handleDeleteIngredient(ingredient.id)}
                    className="text-red-600 active:text-red-800 p-1"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Nom</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Label</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Unité</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Prix</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ingredients.map((ingredient) => (
                <tr key={ingredient.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{ingredient.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {labels.find((l) => l.id === ingredient.labelId)?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{ingredient.unit}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {ingredient.unitPrice ? `${ingredient.unitPrice} FCFA` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => handleEditIngredient(ingredient)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      onClick={() => handleDeleteIngredient(ingredient.id)}
                      className="text-red-600 hover:text-red-800"
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

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => {
              setShowModal(false);
              setSelectedItem(null);
              setErrors({});
            }}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="bg-white rounded-t-2xl sm:rounded-lg p-4 w-full max-w-md sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">
                {modalType === 'ingredient' 
                  ? (selectedItem ? 'Modifier' : 'Nouvel ingrédient')
                  : (selectedItem ? 'Modifier' : 'Nouveau label')
                }
              </h3>

              {modalType === 'ingredient' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input
                      type="text"
                      value={ingredientForm.name}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                      className={`w-full px-3 py-2.5 border rounded-lg text-base ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Tomates"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                    <select
                      value={ingredientForm.labelId}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, labelId: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base"
                    >
                      <option value="">Aucun</option>
                      {labels.map((label) => (
                        <option key={label.id} value={label.id}>{label.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unité *</label>
                    <select
                      value={ingredientForm.unit}
                      onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                      className={`w-full px-3 py-2.5 border rounded-lg text-base ${
                        errors.unit ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Sélectionner</option>
                      {UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire</label>
                    <input
                      type="number"
                      value={ingredientForm.unitPrice || ''}
                      onChange={(e) => setIngredientForm({ 
                        ...ingredientForm, 
                        unitPrice: e.target.value ? parseFloat(e.target.value) : null 
                      })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base"
                      placeholder="Optionnel"
                      min="0"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input
                      type="text"
                      value={labelForm.name}
                      onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })}
                      className={`w-full px-3 py-2.5 border rounded-lg text-base ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Légumes"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={labelForm.description}
                      onChange={(e) => setLabelForm({ ...labelForm, description: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base"
                      placeholder="Optionnel"
                      rows="3"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedItem(null);
                    setErrors({});
                  }}
                  className="flex-1 px-4 py-2.5 text-gray-700 border border-gray-300 rounded-lg active:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={modalType === 'ingredient' ? handleCreateIngredient : handleCreateLabel}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg active:bg-blue-700 disabled:opacity-50"
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

export default IngredientsManager;
