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
  FaTrash,
  FaUtensils,
  FaBoxes,
  FaCheck,
  FaTimes,
  FaArrowUp,
  FaArrowDown
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const SimpleKitchenManager = ({ currentRestaurantId }) => {
  const [productions, setProductions] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'production', 'stock', 'bulk_production', 'bulk_stock'
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);

  // Formulaires simplifiés
  const [form, setForm] = useState({
    department: '',
    product: '',
    quantity: 0,
    unit: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [bulkForm, setBulkForm] = useState({
    department: '',
    date: new Date().toISOString().split('T')[0],
    type: 'production', // production ou stock
    items: [], // [{ productId, quantity, unit }]
    notes: ''
  });

  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [showBulkForm, setShowBulkForm] = useState(false);

  // Produits prédéfinis par département
  const PRODUCTS = {
    'crunchfood': [
      { id: 'quart-poulet', name: 'Quarts de poulet', unit: 'pièce', icon: '🍗' },
      { id: 'morceaux-poulet', name: 'Morceaux de poulet', unit: 'pièce', icon: '🍖' },
      { id: 'sandwichs', name: 'Sandwichs', unit: 'pièce', icon: '🥪' },
      { id: 'mets', name: 'Mets', unit: 'portion', icon: '🍽️' }
    ],
    'mangedabord': [
      { id: 'eru', name: 'Eru', unit: 'portion', icon: '🥬' },
      { id: 'oko-sucre', name: 'Oko sucre', unit: 'portion', icon: '🍯' },
      { id: 'okok-bassa', name: 'Okok bassa', unit: 'portion', icon: '🥘' },
      { id: 'koki', name: 'Koki', unit: 'portion', icon: '🍲' },
      { id: 'ndole', name: 'Ndole', unit: 'portion', icon: '🥗' },
      { id: 'kati-kati', name: 'Kati-kati', unit: 'portion', icon: '🍛' }
    ]
  };

  const DEPARTMENTS = {
    'crunchfood': { label: '🥪 Crunchfood', color: '#F59E0B' },
    'mangedabord': { label: '🍽️ Manged\'Abord', color: '#EF4444' }
  };

  useEffect(() => {
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [productionsSnap, stocksSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'kitchenProductions'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('date', 'desc')
        )),
        getDocs(query(
          collection(db, 'kitchenStocks'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('date', 'desc')
        ))
      ]);

      setProductions(productionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setStocks(stocksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const saveData = async () => {
    try {
      const data = {
        ...form,
        type: 'out', // Tous les enregistrements sont des sorties
        restaurantId: currentRestaurantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const collectionName = modalType === 'production' ? 'kitchenProductions' : 'kitchenStocks';
      
      if (editingItem) {
        await updateDoc(doc(db, collectionName, editingItem.id), data);
        if (modalType === 'production') {
          setProductions(prev => prev.map(p => p.id === editingItem.id ? { ...p, ...data } : p));
        } else {
          setStocks(prev => prev.map(s => s.id === editingItem.id ? { ...s, ...data } : s));
        }
        toast.success('Modifié avec succès');
      } else {
        const ref = await addDoc(collection(db, collectionName), data);
        if (modalType === 'production') {
          setProductions(prev => [{ id: ref.id, ...data }, ...prev]);
        } else {
          setStocks(prev => [{ id: ref.id, ...data }, ...prev]);
        }
        toast.success('Enregistré avec succès');
      }

      closeModal();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const saveBulkData = async () => {
    try {
      if (!bulkForm.department || bulkForm.items.length === 0) {
        toast.error('Sélectionnez un département et au moins un produit');
        return;
      }

      const collectionName = bulkForm.type === 'production' ? 'kitchenProductions' : 'kitchenStocks';
      
      // Créer un enregistrement pour chaque produit
      const promises = bulkForm.items.map(item => {
        if (item.quantity > 0) {
          const data = {
            department: bulkForm.department,
            product: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            date: bulkForm.date,
            type: 'out', // Tous les enregistrements sont des sorties
            notes: bulkForm.notes,
            restaurantId: currentRestaurantId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          return addDoc(collection(db, collectionName), data);
        }
        return null;
      }).filter(Boolean);

      const refs = await Promise.all(promises);
      
      // Mettre à jour l'état local
      const newItems = refs.map((ref, index) => ({
        id: ref.id,
        department: bulkForm.department,
        product: bulkForm.items[index].productId,
        quantity: bulkForm.items[index].quantity,
        unit: bulkForm.items[index].unit,
        date: bulkForm.date,
        type: 'out', // Tous les enregistrements sont des sorties
        notes: bulkForm.notes,
        restaurantId: currentRestaurantId
      }));

      if (bulkForm.type === 'production') {
        setProductions(prev => [...newItems, ...prev]);
      } else {
        setStocks(prev => [...newItems, ...prev]);
      }

      toast.success(`${newItems.length} éléments enregistrés avec succès`);
      closeModal();
    } catch (error) {
      console.error('Erreur sauvegarde en lot:', error);
      toast.error('Erreur lors de la sauvegarde en lot');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setForm({
      department: '',
      product: '',
      quantity: 0,
      unit: '',
      date: new Date().toISOString().split('T')[0],
      type: 'in',
      notes: ''
    });
    setBulkForm({
      department: '',
      date: new Date().toISOString().split('T')[0],
      type: 'in',
      items: [],
      notes: ''
    });
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    if (item) {
      setEditingItem(item);
      setForm({
        department: item.department,
        product: item.product,
        quantity: item.quantity,
        unit: item.unit,
        date: item.date,
        notes: item.notes || ''
      });
      setShowModal(true);
    } else if (type === 'bulk_production' || type === 'bulk_stock') {
      // Initialiser le formulaire en lot
      setBulkForm({
        department: '',
        date: new Date().toISOString().split('T')[0],
        type: type,
        items: [],
        notes: ''
      });
      setShowModal(true);
    } else {
      setShowModal(true);
    }
  };

  const selectDepartment = (department, type) => {
    setSelectedDepartment(department);
    setBulkForm({
      department: department,
      date: new Date().toISOString().split('T')[0],
      type: type,
      items: [],
      notes: ''
    });
    setShowBulkForm(true);
  };

  const addBulkItem = (productId, productName, unit) => {
    const existingItem = bulkForm.items.find(item => item.productId === productId);
    if (existingItem) {
      setBulkForm(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }));
    } else {
      setBulkForm(prev => ({
        ...prev,
        items: [...prev.items, { productId, productName, quantity: 1, unit }]
      }));
    }
  };

  const updateBulkItem = (productId, field, value) => {
    setBulkForm(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.productId === productId
          ? { ...item, [field]: value }
          : item
      )
    }));
  };

  const removeBulkItem = (productId) => {
    setBulkForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.productId !== productId)
    }));
  };

  const deleteItem = async (item, type) => {
    if (!window.confirm('Supprimer cet élément ?')) return;
    
    try {
      const collectionName = type === 'production' ? 'kitchenProductions' : 'kitchenStocks';
      await updateDoc(doc(db, collectionName, item.id), {
        deleted: true,
        deletedAt: serverTimestamp()
      });
      
      if (type === 'production') {
        setProductions(prev => prev.filter(p => p.id !== item.id));
      } else {
        setStocks(prev => prev.filter(s => s.id !== item.id));
      }
      
      toast.success('Supprimé avec succès');
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Calculer les totaux
  const getTotals = () => {
    const totals = {};
    
    // Productions
    productions.forEach(prod => {
      if (!totals[prod.department]) {
        totals[prod.department] = {};
      }
      if (!totals[prod.department][prod.product]) {
        totals[prod.department][prod.product] = { production: 0, stock: 0 };
      }
      totals[prod.department][prod.product].production += prod.quantity;
    });

    // Stocks
    stocks.forEach(stock => {
      if (!totals[stock.department]) {
        totals[stock.department] = {};
      }
      if (!totals[stock.department][stock.product]) {
        totals[stock.department][stock.product] = { production: 0, stock: 0 };
      }
      totals[stock.department][stock.product].stock += stock.type === 'in' ? stock.quantity : -stock.quantity;
    });

    return totals;
  };

  const totals = getTotals();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header avec boutons d'action */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800">🍳 Cuisine</h3>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Productions et stocks</p>
          </div>
          <div className="text-center">
            <p className="text-sm sm:text-base text-gray-500">
              Cliquez sur "Prod" ou "Stock" d'un département pour commencer
            </p>
          </div>
        </div>
      </div>

      {/* Résumé par département */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {Object.entries(DEPARTMENTS).map(([deptKey, dept]) => (
          <div key={deptKey} className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-lg sm:text-xl"
                  style={{ backgroundColor: dept.color }}
                >
                  {dept.label.split(' ')[0]}
                </div>
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-gray-800">{dept.label}</h4>
                  <p className="text-sm sm:text-base text-gray-600">Totaux</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => selectDepartment(deptKey, 'production')}
                  className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 text-sm font-medium flex items-center justify-center space-x-2"
                >
                  <FaUtensils className="text-sm" />
                  <span>Production</span>
                </button>
                <button
                  onClick={() => selectDepartment(deptKey, 'stock')}
                  className="w-full sm:w-auto px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 text-sm font-medium flex items-center justify-center space-x-2"
                >
                  <FaBoxes className="text-sm" />
                  <span>Stock</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              {PRODUCTS[deptKey]?.map(product => {
                const productTotals = totals[deptKey]?.[product.id] || { production: 0, stock: 0 };
                
                return (
                  <div key={product.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <span className="text-xl sm:text-2xl">{product.icon}</span>
                      <div>
                        <p className="font-medium text-gray-800 text-sm sm:text-base">{product.name}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{product.unit}</p>
                      </div>
                    </div>
                    <div className="flex space-x-3 sm:space-x-4 text-sm sm:text-base">
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">Prod</p>
                        <p className="font-bold text-blue-600">{productTotals.production}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">Stock</p>
                        <p className={`font-bold ${productTotals.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {productTotals.stock}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Sheet pour la sélection des produits */}
      {showBulkForm && selectedDepartment && (
        <>
          {/* Overlay pour mobile */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
            onClick={() => setShowBulkForm(false)}
          />
          
          {/* Bottom Sheet pour mobile */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[80vh] overflow-hidden sm:hidden">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
            </div>
            
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {bulkForm.type === 'production' ? 'Production' : 'Stock'} - {DEPARTMENTS[selectedDepartment]?.label}
                  </h3>
                  <p className="text-sm text-gray-600">Ajustez les quantités directement</p>
                </div>
                <button
                  onClick={() => setShowBulkForm(false)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100"
                >
                  <FaTimes size={20} />
                </button>
              </div>
            </div>

            {/* Contenu scrollable */}
            <div className="overflow-y-auto max-h-[60vh]">
              {/* Produits avec quantités directes */}
              <div className="p-4 space-y-2">
                {PRODUCTS[selectedDepartment]?.map(product => {
                  const existingItem = bulkForm.items.find(item => item.productId === product.id);
                  const quantity = existingItem?.quantity || 0;
                  
                  return (
                    <div key={product.id} className="bg-gray-50 rounded-lg p-3">
                      {/* Ligne 1: Produit et Quantité */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">{product.icon}</span>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.unit}</p>
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-800">{quantity}</div>
                          <div className="text-xs text-gray-500">{product.unit}</div>
                        </div>
                      </div>
                      
                      {/* Ligne 2: Boutons + et - */}
                      <div className="flex items-center justify-center space-x-4">
                        <button
                          onClick={() => {
                            if (quantity > 0) {
                              updateBulkItem(product.id, 'quantity', quantity - 1);
                            } else {
                              removeBulkItem(product.id);
                            }
                          }}
                          className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                          disabled={quantity === 0}
                        >
                          <FaTimes className="text-sm" />
                        </button>
                        
                        <button
                          onClick={() => {
                            if (quantity === 0) {
                              addBulkItem(product.id, product.name, product.unit);
                            } else {
                              updateBulkItem(product.id, 'quantity', quantity + 1);
                            }
                          }}
                          className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                        >
                          <FaPlus className="text-sm" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Information pour les productions */}
              {bulkForm.type === 'production' && (
                <div className="px-4 py-3 border-t border-gray-200 bg-blue-50">
                  <div className="flex items-center space-x-2">
                    <FaUtensils className="text-blue-600" />
                    <p className="text-sm text-blue-800 font-medium">
                      Les productions sont automatiquement des sorties de stock
                    </p>
                  </div>
                </div>
              )}

              {/* Date et notes */}
              <div className="px-4 py-3 border-t border-gray-200">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                    <input
                      type="date"
                      value={bulkForm.date}
                      onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optionnel)</label>
                    <input
                      type="text"
                      value={bulkForm.notes}
                      onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      placeholder="Ajoutez des notes..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer avec boutons d'action */}
            <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkForm(false)}
                  className="flex-1 px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors text-base rounded-lg border-2 border-gray-300 hover:border-gray-400"
                >
                  Annuler
                </button>
                <button
                  onClick={saveBulkData}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-base font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                  disabled={bulkForm.items.length === 0}
                >
                  Enregistrer {bulkForm.items.length} éléments
                </button>
              </div>
            </div>
          </div>

          {/* Modal pour desktop */}
          <div className="hidden sm:block fixed inset-0 bg-black bg-opacity-50 z-40">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800">
                        {bulkForm.type === 'production' ? 'Production' : 'Stock'} - {DEPARTMENTS[selectedDepartment]?.label}
                      </h3>
                      <p className="text-sm text-gray-600">Ajustez les quantités directement</p>
                    </div>
                    <button
                      onClick={() => setShowBulkForm(false)}
                      className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100"
                    >
                      <FaTimes size={20} />
                    </button>
                  </div>
                </div>

                {/* Contenu scrollable */}
                <div className="overflow-y-auto max-h-[60vh]">
                  {/* Produits avec quantités directes */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {PRODUCTS[selectedDepartment]?.map(product => {
                        const existingItem = bulkForm.items.find(item => item.productId === product.id);
                        const quantity = existingItem?.quantity || 0;
                        
                        return (
                          <div key={product.id} className="bg-gray-50 rounded-lg p-4">
                            {/* Ligne 1: Produit et Quantité */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <span className="text-2xl">{product.icon}</span>
                                <div>
                                  <p className="font-medium text-gray-800 text-base">{product.name}</p>
                                  <p className="text-sm text-gray-500">{product.unit}</p>
                                </div>
                              </div>
                              
                              <div className="text-center">
                                <div className="text-xl font-bold text-gray-800">{quantity}</div>
                                <div className="text-sm text-gray-500">{product.unit}</div>
                              </div>
                            </div>
                            
                            {/* Ligne 2: Boutons + et - */}
                            <div className="flex items-center justify-center space-x-4">
                              <button
                                onClick={() => {
                                  if (quantity > 0) {
                                    updateBulkItem(product.id, 'quantity', quantity - 1);
                                  } else {
                                    removeBulkItem(product.id);
                                  }
                                }}
                                className="w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                disabled={quantity === 0}
                              >
                                <FaTimes className="text-base" />
                              </button>
                              
                              <button
                                onClick={() => {
                                  if (quantity === 0) {
                                    addBulkItem(product.id, product.name, product.unit);
                                  } else {
                                    updateBulkItem(product.id, 'quantity', quantity + 1);
                                  }
                                }}
                                className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                              >
                                <FaPlus className="text-base" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Information pour les productions */}
                  {bulkForm.type === 'production' && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-blue-50">
                      <div className="flex items-center space-x-2">
                        <FaUtensils className="text-blue-600" />
                        <p className="text-sm text-blue-800 font-medium">
                          Les productions sont automatiquement des sorties de stock
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Date et notes */}
                  <div className="px-6 py-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                        <input
                          type="date"
                          value={bulkForm.date}
                          onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })}
                          className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optionnel)</label>
                        <input
                          type="text"
                          value={bulkForm.notes}
                          onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })}
                          className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                          placeholder="Ajoutez des notes..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer avec boutons d'action */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowBulkForm(false)}
                      className="flex-1 px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors text-base rounded-lg border-2 border-gray-300 hover:border-gray-400"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={saveBulkData}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-base font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                      disabled={bulkForm.items.length === 0}
                    >
                      Enregistrer {bulkForm.items.length} éléments
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Liste des opérations récentes */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-4">📋 Opérations Récentes</h3>
        
        <div className="space-y-2">
          {[...productions.slice(0, 5), ...stocks.slice(0, 5)]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10)
            .map(item => {
              const isProduction = productions.some(p => p.id === item.id);
              const dept = DEPARTMENTS[item.department];
              const product = PRODUCTS[item.department]?.find(p => p.id === item.product);
              
              return (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                      style={{ backgroundColor: dept?.color || '#6B7280' }}
                    >
                      {dept?.label.split(' ')[0] || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm sm:text-base">
                        {product?.name || item.product}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {item.date} • {item.quantity} {item.unit}
                        {isProduction ? ' • Production' : ` • ${item.type === 'in' ? 'Entrée' : 'Sortie'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1 sm:space-x-2">
                    <button
                      onClick={() => openModal(isProduction ? 'production' : 'stock', item)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <FaEdit className="text-sm" />
                    </button>
                    <button
                      onClick={() => deleteItem(item, isProduction ? 'production' : 'stock')}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Modal simplifié */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full h-[95vh] sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-blue-50 to-green-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                      {modalType === 'production' && 'Nouvelle Production'}
                      {modalType === 'stock' && 'Mouvement Stock'}
                      {modalType === 'bulk_production' && 'Productions Multiples'}
                      {modalType === 'bulk_stock' && 'Stocks Multiples'}
                    </h3>
                    <p className="text-base sm:text-lg text-gray-600 mt-1">
                      {editingItem ? 'Modifier' : 
                       modalType.includes('bulk') ? 'Sélectionnez plusieurs produits' : 'Enregistrer'}
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>
              </div>

              {/* Contenu */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {modalType.includes('bulk') ? (
                  // Interface pour opérations en lot
                  <div className="space-y-4 sm:space-y-6">
                    {/* Département */}
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Département *</label>
                      <select
                        value={bulkForm.department}
                        onChange={(e) => setBulkForm({ ...bulkForm, department: e.target.value, items: [] })}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        required
                      >
                        <option value="">Choisir...</option>
                        {Object.entries(DEPARTMENTS).map(([key, dept]) => (
                          <option key={key} value={key}>
                            {dept.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Liste des produits du département */}
                    {bulkForm.department && (
                      <div>
                        <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Produits disponibles</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                          {PRODUCTS[bulkForm.department]?.map(product => (
                            <button
                              key={product.id}
                              onClick={() => addBulkItem(product.id, product.name, product.unit)}
                              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{product.icon}</span>
                                <span className="text-sm sm:text-base font-medium">{product.name}</span>
                              </div>
                              <FaPlus className="text-blue-600 text-sm" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Produits sélectionnés */}
                    {bulkForm.items.length > 0 && (
                      <div>
                        <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Produits sélectionnés</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                          {bulkForm.items.map(item => (
                            <div key={item.productId} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{PRODUCTS[bulkForm.department]?.find(p => p.id === item.productId)?.icon}</span>
                                <span className="text-sm sm:text-base font-medium">{item.productName}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateBulkItem(item.productId, 'quantity', Number(e.target.value))}
                                  className="w-16 px-2 py-1 border rounded text-center text-sm"
                                  min="0"
                                  step="0.1"
                                />
                                <span className="text-xs text-gray-500">{item.unit}</span>
                                <button
                                  onClick={() => removeBulkItem(item.productId)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                >
                                  <FaTimes className="text-sm" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Date */}
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Date *</label>
                      <input
                        type="date"
                        value={bulkForm.date}
                        onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        required
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Notes (optionnel)</label>
                      <textarea
                        value={bulkForm.notes}
                        onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        rows="2"
                        placeholder="Ajoutez des notes..."
                      />
                    </div>
                  </div>
                ) : (
                  // Interface pour opérations simples
                  <div className="space-y-4 sm:space-y-6">
                    {/* Département */}
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Département *</label>
                      <select
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value, product: '' })}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        required
                      >
                        <option value="">Choisir...</option>
                        {Object.entries(DEPARTMENTS).map(([key, dept]) => (
                          <option key={key} value={key}>
                            {dept.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Produit */}
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Produit *</label>
                      <select
                        value={form.product}
                        onChange={(e) => {
                          const selectedProduct = e.target.value;
                          const product = PRODUCTS[form.department]?.find(p => p.id === selectedProduct);
                          setForm({ 
                            ...form, 
                            product: selectedProduct,
                            unit: product?.unit || ''
                          });
                        }}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        required
                        disabled={!form.department}
                      >
                        <option value="">Choisir...</option>
                        {form.department && PRODUCTS[form.department]?.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.icon} {product.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantité */}
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Quantité *</label>
                      <input
                        type="number"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        min="0"
                        step="0.1"
                        required
                      />
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Date *</label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        required
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Notes (optionnel)</label>
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        rows="2"
                        placeholder="Ajoutez des notes..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 border-t bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors text-base sm:text-lg rounded-lg border"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      if (modalType.includes('bulk')) {
                        saveBulkData();
                      } else {
                        saveData();
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-base sm:text-lg"
                    disabled={modalType.includes('bulk') && bulkForm.items.length === 0}
                  >
                    {editingItem ? 'Modifier' : 
                     modalType.includes('bulk') ? `Enregistrer ${bulkForm.items.length} éléments` : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SimpleKitchenManager;
