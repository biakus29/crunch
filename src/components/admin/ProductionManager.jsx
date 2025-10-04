import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import {
  FaCogs,
  FaPlus,
  FaEdit,
  FaEye,
  FaUtensils,
  FaClipboardCheck,
  FaChartBar
} from 'react-icons/fa';

const ProductionManager = ({ currentRestaurantId }) => {
  const [productions, setProductions] = useState([]);
  const [productionTypes, setProductionTypes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [menus, setMenus] = useState([]);
  const [dailyProductions, setDailyProductions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'type' or 'daily'
  const [loading, setLoading] = useState(true);

  const [productionTypeForm, setProductionTypeForm] = useState({
    name: '',
    description: '',
    ingredients: [], // { ingredientId, quantity, unit }
    menus: [], // { menuId, quantity }
    productions: [] // { productionTypeId, quantity } pour les productions qui consomment d'autres productions
  });

  const [dailyProductionForm, setDailyProductionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    productions: [] // { productionTypeId, quantityProduced, remainingStock }
  });

  useEffect(() => {
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      const [
        productionTypesSnap,
        ingredientsSnap,
        menusSnap,
        dailyProductionsSnap
      ] = await Promise.all([
        getDocs(query(
          collection(db, 'productionTypes'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('name')
        )),
        getDocs(query(
          collection(db, 'ingredients'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('name')
        )),
        getDocs(query(
          collection(db, 'menus'),
          where('restaurantId', '==', currentRestaurantId)
        )),
        getDocs(query(
          collection(db, 'dailyProductions'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('date', 'desc')
        ))
      ]);

      setProductionTypes(productionTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIngredients(ingredientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setMenus(menusSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDailyProductions(dailyProductionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setLoading(false);
    }
  };

  const createProductionType = async () => {
    try {
      const productionData = {
        ...productionTypeForm,
        restaurantId: currentRestaurantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, 'productionTypes'), productionData);
      setProductionTypes(prev => [...prev, { id: ref.id, ...productionData }]);
      setShowCreateModal(false);
      setProductionTypeForm({
        name: '',
        description: '',
        ingredients: [],
        menus: [],
        productions: []
      });
    } catch (error) {
      console.error('Erreur création type production:', error);
      alert('Erreur lors de la création du type de production');
    }
  };

  const recordDailyProduction = async () => {
    try {
      const productionData = {
        ...dailyProductionForm,
        restaurantId: currentRestaurantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, 'dailyProductions'), productionData);
      setDailyProductions(prev => [{ id: ref.id, ...productionData }, ...prev]);
      setShowProductionModal(false);
      setDailyProductionForm({
        date: new Date().toISOString().split('T')[0],
        productions: []
      });
    } catch (error) {
      console.error('Erreur enregistrement production:', error);
      alert('Erreur lors de l\'enregistrement de la production');
    }
  };

  const addIngredientToProduction = () => {
    setProductionTypeForm({
      ...productionTypeForm,
      ingredients: [...productionTypeForm.ingredients, { ingredientId: '', quantity: 0, unit: 'kg' }]
    });
  };

  const updateIngredientInProduction = (index, field, value) => {
    const updatedIngredients = [...productionTypeForm.ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
    setProductionTypeForm({ ...productionTypeForm, ingredients: updatedIngredients });
  };

  const removeIngredientFromProduction = (index) => {
    const updatedIngredients = productionTypeForm.ingredients.filter((_, i) => i !== index);
    setProductionTypeForm({ ...productionTypeForm, ingredients: updatedIngredients });
  };

  const addMenuToProduction = () => {
    setProductionTypeForm({
      ...productionTypeForm,
      menus: [...productionTypeForm.menus, { menuId: '', quantity: 1 }]
    });
  };

  const updateMenuInProduction = (index, field, value) => {
    const updatedMenus = [...productionTypeForm.menus];
    updatedMenus[index] = { ...updatedMenus[index], [field]: value };
    setProductionTypeForm({ ...productionTypeForm, menus: updatedMenus });
  };

  const removeMenuFromProduction = (index) => {
    const updatedMenus = productionTypeForm.menus.filter((_, i) => i !== index);
    setProductionTypeForm({ ...productionTypeForm, menus: updatedMenus });
  };

  const addProductionToDaily = () => {
    setDailyProductionForm({
      ...dailyProductionForm,
      productions: [...dailyProductionForm.productions, { productionTypeId: '', quantityProduced: 0, remainingStock: 0 }]
    });
  };

  const updateDailyProduction = (index, field, value) => {
    const updatedProductions = [...dailyProductionForm.productions];
    updatedProductions[index] = { ...updatedProductions[index], [field]: value };
    setDailyProductionForm({ ...dailyProductionForm, productions: updatedProductions });
  };

  const removeDailyProduction = (index) => {
    const updatedProductions = dailyProductionForm.productions.filter((_, i) => i !== index);
    setDailyProductionForm({ ...dailyProductionForm, productions: updatedProductions });
  };

  if (loading) {
    return <div className="p-4 text-center sm:p-6">Chargement...</div>;
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="flex flex-col justify-between items-start gap-2 sm:flex-row sm:items-center">
        <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">Gestion de la Production</h3>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            onClick={() => { setModalType('type'); setShowCreateModal(true); }}
            className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition duration-200 sm:px-4 sm:py-2 sm:text-sm flex items-center justify-center gap-1 sm:gap-2"
          >
            <FaPlus className="text-xs sm:text-sm" /> Type de Production
          </button>
          <button
            onClick={() => { setModalType('daily'); setShowProductionModal(true); }}
            className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition duration-200 sm:px-4 sm:py-2 sm:text-sm flex items-center justify-center gap-1 sm:gap-2"
          >
            <FaClipboardCheck className="text-xs sm:text-sm" /> Enregistrer Production
          </button>
        </div>
      </div>

      {/* Types de production */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-3 border-b sm:p-4">
          <h4 className="font-semibold text-base text-gray-800 flex items-center gap-1 sm:text-lg sm:gap-2">
            <FaCogs className="text-sm sm:text-base" /> Types de Production
          </h4>
        </div>
        {/* Mobile: Cards */}
        <div className="space-y-2 p-2 md:hidden sm:p-3">
          {productionTypes.map(type => (
            <div key={type.id} className="border rounded-lg p-2 sm:p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold text-sm text-gray-800 truncate sm:text-base">{type.name}</h5>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 sm:text-sm">{type.description}</p>
                </div>
                <div className="flex space-x-2 text-base sm:space-x-3 sm:text-lg">
                  <button className="text-blue-600 hover:text-blue-800">
                    <FaEye />
                  </button>
                  <button className="text-green-600 hover:text-green-800">
                    <FaEdit />
                  </button>
                </div>
              </div>
              <div className="mt-1 text-xs flex gap-3 sm:mt-2 sm:text-sm">
                <p className="text-blue-600 font-medium">
                  {type.ingredients?.length || 0} ingrédient(s)
                </p>
                <p className="text-green-600 font-medium">
                  {type.menus?.length || 0} menu(s)
                </p>
              </div>
            </div>
          ))}
        </div>
        {/* Desktop: Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left font-semibold text-lg text-gray-700">Nom</th>
                <th className="px-6 py-4 text-left font-semibold text-lg text-gray-700">Description</th>
                <th className="px-6 py-4 text-left font-semibold text-lg text-gray-700">Ingrédients</th>
                <th className="px-6 py-4 text-left font-semibold text-lg text-gray-700">Menus concernés</th>
                <th className="px-6 py-4 text-left font-semibold text-lg text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {productionTypes.map(type => (
                <tr key={type.id}>
                  <td className="px-6 py-4 font-bold text-lg text-gray-800">{type.name}</td>
                  <td className="px-6 py-4 text-base text-gray-600">{type.description}</td>
                  <td className="px-6 py-4">
                    <span className="text-base text-blue-600 font-medium">
                      {type.ingredients?.length || 0} ingrédient(s)
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-base text-green-600 font-medium">
                      {type.menus?.length || 0} menu(s)
                    </span>
                  </td>
                  <td className="px-6 py-4 space-x-3">
                    <button className="text-blue-600 hover:text-blue-800 text-xl">
                      <FaEye />
                    </button>
                    <button className="text-green-600 hover:text-green-800 text-xl">
                      <FaEdit />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Productions quotidiennes */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-3 border-b sm:p-4">
          <h4 className="font-semibold flex items-center gap-1 text-base sm:gap-2 sm:text-lg">
            <FaUtensils /> Productions Quotidiennes
          </h4>
        </div>
        {/* Mobile: Cards */}
        <div className="space-y-2 p-3 md:hidden sm:p-4">
          {dailyProductions.map(production => {
            const totalProduced = production.productions?.reduce((sum, p) => sum + p.quantityProduced, 0) || 0;
            const totalRemaining = production.productions?.reduce((sum, p) => sum + p.remainingStock, 0) || 0;

            return (
              <div key={production.id} className="border rounded-lg p-2 sm:p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-medium text-sm sm:text-base">{production.date}</h5>
                    <p className="text-xs text-blue-600 sm:text-sm">
                      {production.productions?.length || 0} type(s)
                    </p>
                  </div>
                  <div className="space-x-1 sm:space-x-2">
                    <button className="text-blue-600 hover:text-blue-800 text-base">
                      <FaEye />
                    </button>
                    <button className="text-green-600 hover:text-green-800 text-base">
                      <FaEdit />
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs sm:text-sm">
                  <p className="text-green-600 font-semibold">
                    Produit: {totalProduced}
                  </p>
                  <p className="text-orange-600 font-semibold">
                    Restant: {totalRemaining}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {/* Desktop: Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Productions</th>
                <th className="px-4 py-2 text-left">Quantité totale</th>
                <th className="px-4 py-2 text-left">Stock restant</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dailyProductions.map(production => {
                const totalProduced = production.productions?.reduce((sum, p) => sum + p.quantityProduced, 0) || 0;
                const totalRemaining = production.productions?.reduce((sum, p) => sum + p.remainingStock, 0) || 0;

                return (
                  <tr key={production.id}>
                    <td className="px-4 py-2 font-medium">{production.date}</td>
                    <td className="px-4 py-2">
                      <span className="text-sm text-blue-600">
                        {production.productions?.length || 0} type(s)
                      </span>
                    </td>
                    <td className="px-4 py-2 font-semibold text-green-600">
                      {totalProduced}
                    </td>
                    <td className="px-4 py-2 font-semibold text-orange-600">
                      {totalRemaining}
                    </td>
                    <td className="px-4 py-2 space-x-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <FaEye />
                      </button>
                      <button className="text-green-600 hover:text-green-800">
                        <FaEdit />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal création type de production */}
      <AnimatePresence>
        {showCreateModal && modalType === 'type' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-4 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto sm:p-6"
            >
              <h3 className="text-base font-semibold mb-3 sm:text-lg sm:mb-4">Nouveau Type de Production</h3>
              
              <div className="space-y-4 sm:space-y-6">
                {/* Informations de base */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1 sm:text-sm">Nom</label>
                    <input
                      type="text"
                      value={productionTypeForm.name}
                      onChange={(e) => setProductionTypeForm({...productionTypeForm, name: e.target.value})}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm sm:py-2"
                      placeholder="Ex: Quart braisé"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 sm:text-sm">Description</label>
                    <input
                      type="text"
                      value={productionTypeForm.description}
                      onChange={(e) => setProductionTypeForm({...productionTypeForm, description: e.target.value})}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm sm:py-2"
                      placeholder="Description de la production"
                    />
                  </div>
                </div>

                {/* Ingrédients consommés */}
                <div>
                  <div className="flex justify-between items-center mb-2 sm:mb-3">
                    <h4 className="font-semibold text-sm sm:text-base">Ingrédients consommés</h4>
                    <button
                      onClick={addIngredientToProduction}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs sm:px-3 sm:text-sm"
                    >
                      <FaPlus className="inline mr-1" /> Ajouter
                    </button>
                  </div>
                  <div className="space-y-2">
                    {productionTypeForm.ingredients.map((ingredient, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <select
                          value={ingredient.ingredientId}
                          onChange={(e) => updateIngredientInProduction(index, 'ingredientId', e.target.value)}
                          className="flex-1 px-2 py-1 border rounded-lg text-xs sm:px-3 sm:py-2 sm:text-sm"
                        >
                          <option value="">Sélectionner un ingrédient</option>
                          {ingredients.map(ing => (
                            <option key={ing.id} value={ing.id}>{ing.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={ingredient.quantity}
                          onChange={(e) => updateIngredientInProduction(index, 'quantity', Number(e.target.value))}
                          className="w-20 px-2 py-1 border rounded-lg text-xs sm:w-24 sm:py-2 sm:text-sm"
                          placeholder="Qté"
                          step="0.1"
                        />
                        <select
                          value={ingredient.unit}
                          onChange={(e) => updateIngredientInProduction(index, 'unit', e.target.value)}
                          className="w-16 px-2 py-1 border rounded-lg text-xs sm:w-20 sm:py-2 sm:text-sm"
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="l">l</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                        </select>
                        <button
                          onClick={() => removeIngredientFromProduction(index)}
                          className="text-red-600 hover:text-red-800 text-base"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Menus concernés */}
                <div>
                  <div className="flex justify-between items-center mb-2 sm:mb-3">
                    <h4 className="font-semibold text-sm sm:text-base">Menus concernés</h4>
                    <button
                      onClick={addMenuToProduction}
                      className="px-2 py-1 bg-green-600 text-white rounded text-xs sm:px-3 sm:text-sm"
                    >
                      <FaPlus className="inline mr-1" /> Ajouter
                    </button>
                  </div>
                  <div className="space-y-2">
                    {productionTypeForm.menus.map((menu, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <select
                          value={menu.menuId}
                          onChange={(e) => updateMenuInProduction(index, 'menuId', e.target.value)}
                          className="flex-1 px-2 py-1 border rounded-lg text-xs sm:px-3 sm:py-2 sm:text-sm"
                        >
                          <option value="">Sélectionner un menu</option>
                          {menus.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={menu.quantity}
                          onChange={(e) => updateMenuInProduction(index, 'quantity', Number(e.target.value))}
                          className="w-20 px-2 py-1 border rounded-lg text-xs sm:w-24 sm:py-2 sm:text-sm"
                          placeholder="Qté"
                          min="1"
                        />
                        <span className="text-xs text-gray-600 sm:text-sm">portion(s)</span>
                        <button
                          onClick={() => removeMenuFromProduction(index)}
                          className="text-red-600 hover:text-red-800 text-base"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-4 sm:mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-xs sm:px-4 sm:py-2 sm:text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={createProductionType}
                  disabled={!productionTypeForm.name}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-xs sm:px-4 sm:py-2 sm:text-sm"
                >
                  Créer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal enregistrement production quotidienne */}
      <AnimatePresence>
        {showProductionModal && modalType === 'daily' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-4 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto sm:p-6"
            >
              <h3 className="text-base font-semibold mb-3 sm:text-lg sm:mb-4">Enregistrer Production du Jour</h3>
              
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1 sm:text-sm">Date</label>
                  <input
                    type="date"
                    value={dailyProductionForm.date}
                    onChange={(e) => setDailyProductionForm({...dailyProductionForm, date: e.target.value})}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm sm:py-2"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2 sm:mb-3">
                    <h4 className="font-semibold text-sm sm:text-base">Productions</h4>
                    <button
                      onClick={addProductionToDaily}
                      className="px-2 py-1 bg-green-600 text-white rounded text-xs sm:px-3 sm:text-sm"
                    >
                      <FaPlus className="inline mr-1" /> Ajouter
                    </button>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {dailyProductionForm.productions.map((production, index) => (
                      <div key={index} className="border rounded-lg p-2 sm:p-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">Type de production</label>
                            <select
                              value={production.productionTypeId}
                              onChange={(e) => updateDailyProduction(index, 'productionTypeId', e.target.value)}
                              className="w-full px-2 py-1 border rounded-lg text-xs sm:px-3 sm:py-2 sm:text-sm"
                            >
                              <option value="">Sélectionner</option>
                              {productionTypes.map(type => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Quantité produite</label>
                            <input
                              type="number"
                              value={production.quantityProduced}
                              onChange={(e) => updateDailyProduction(index, 'quantityProduced', Number(e.target.value))}
                              className="w-full px-2 py-1 border rounded-lg text-xs sm:px-3 sm:py-2 sm:text-sm"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Stock restant</label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={production.remainingStock}
                                onChange={(e) => updateDailyProduction(index, 'remainingStock', Number(e.target.value))}
                                className="flex-1 px-2 py-1 border rounded-lg text-xs sm:px-3 sm:py-2 sm:text-sm"
                                min="0"
                              />
                              <button
                                onClick={() => removeDailyProduction(index)}
                                className="text-red-600 hover:text-red-800 text-base"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-4 sm:mt-6">
                <button
                  onClick={() => setShowProductionModal(false)}
                  className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-xs sm:px-4 sm:py-2 sm:text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={recordDailyProduction}
                  disabled={dailyProductionForm.productions.length === 0}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg disabled:opacity-50 text-xs sm:px-4 sm:py-2 sm:text-sm"
                >
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionManager;