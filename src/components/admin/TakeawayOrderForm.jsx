import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { auth } from '../../firebase';
import {
  FaShoppingBag,
  FaPlus,
  FaMinus,
  FaMoneyBillWave,
  FaMobileAlt,
  FaUniversity,
  FaUser,
  FaPhone,
  FaCheck,
  FaTimes
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const TakeawayOrderForm = ({ currentRestaurantId, onClose, onOrderCreated }) => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDetails, setPaymentDetails] = useState({
    mobileProvider: 'OM', // OM ou MOMO
    transactionId: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Moyens de paiement disponibles
  const paymentMethods = [
    { id: 'cash', label: 'Espèces', icon: FaMoneyBillWave, color: 'green' },
    { id: 'mobile_money', label: 'Mobile Money', icon: FaMobileAlt, color: 'blue' },
    { id: 'bank_transfer', label: 'Virement', icon: FaUniversity, color: 'purple' }
  ];

  const mobileProviders = [
    { id: 'OM', label: 'OM', color: 'orange' },
    { id: 'MOMO', label: 'MTN', color: 'yellow' }
  ];

  // Charger les items du menu
  useEffect(() => {
    const loadMenuData = async () => {
      try {
        setLoading(true);
        
        // Charger les catégories
        const categoriesQuery = query(
          collection(db, 'categories'),
          where('restaurantId', '==', currentRestaurantId)
        );
        const categoriesSnap = await getDocs(categoriesQuery);
        const categoriesData = categoriesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCategories(categoriesData);

        // Charger les items
        const itemsQuery = query(
          collection(db, 'items'),
          where('restaurantId', '==', currentRestaurantId),
          where('available', '==', true)
        );
        const itemsSnap = await getDocs(itemsQuery);
        const itemsData = itemsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setItems(itemsData);
      } catch (error) {
        console.error('Erreur chargement menu:', error);
        toast.error('Erreur lors du chargement du menu');
      } finally {
        setLoading(false);
      }
    };

    if (currentRestaurantId) {
      loadMenuData();
    }
  }, [currentRestaurantId]);

  // Calculer le total
  const orderTotal = useMemo(() => {
    return Object.entries(selectedItems).reduce((total, [itemId, quantity]) => {
      const item = items.find(i => i.id === itemId);
      if (!item || quantity <= 0) return total;
      
      const price = typeof item.price === 'string' 
        ? parseFloat(item.price.replace(/\./g, '')) || 0 
        : Number(item.price) || 0;
      
      return total + (price * quantity);
    }, 0);
  }, [selectedItems, items]);

  // Ajouter/retirer un item
  const updateItemQuantity = (itemId, change) => {
    setSelectedItems(prev => {
      const currentQty = prev[itemId] || 0;
      const newQty = Math.max(0, currentQty + change);
      
      if (newQty === 0) {
        const { [itemId]: removed, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [itemId]: newQty };
    });
  };

  // Soumettre la commande
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (Object.keys(selectedItems).length === 0) {
      toast.error('Veuillez sélectionner au moins un article');
      return;
    }

    if (!customerInfo.name.trim()) {
      toast.error('Veuillez saisir le nom du client');
      return;
    }

    if (paymentMethod === 'mobile_money' && !paymentDetails.transactionId.trim()) {
      toast.error('Veuillez saisir l\'ID de transaction');
      return;
    }

    try {
      setSubmitting(true);

      // Préparer les données de la commande
      const orderItems = Object.entries(selectedItems).map(([itemId, quantity]) => {
        const item = items.find(i => i.id === itemId);
        const price = typeof item.price === 'string' 
          ? parseFloat(item.price.replace(/\./g, '')) || 0 
          : Number(item.price) || 0;
        
        return {
          id: itemId,
          name: item.name,
          price: price,
          quantity: quantity,
          total: price * quantity
        };
      });

      // Détails du paiement selon la méthode
      let paymentInfo = {
        method: paymentMethod,
        status: 'paid', // Commande à emporter = paiement immédiat
        paidAt: Timestamp.now()
      };

      if (paymentMethod === 'mobile_money') {
        paymentInfo = {
          ...paymentInfo,
          provider: paymentDetails.mobileProvider,
          transactionId: paymentDetails.transactionId
        };
      }

      // Créer la commande
      const orderData = {
        type: 'takeaway', // Type à emporter
        status: 'confirmed', // Confirmée immédiatement
        customer: {
          name: customerInfo.name.trim(),
          phone: customerInfo.phone.trim() || null
        },
        items: orderItems,
        subtotal: orderTotal,
        deliveryFee: 0, // Pas de frais de livraison pour à emporter
        total: orderTotal,
        payment: paymentInfo,
        restaurantId: currentRestaurantId,
        createdByManager: auth.currentUser?.email || 'unknown', // Tracker le gérant qui crée la commande
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        notes: 'Commande à emporter créée en interne'
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      toast.success('Commande à emporter créée avec succès !');
      
      // Callback pour rafraîchir la liste des commandes
      if (onOrderCreated) {
        onOrderCreated({ id: docRef.id, ...orderData });
      }
      
      onClose();
    } catch (error) {
      console.error('Erreur création commande:', error);
      toast.error('Erreur lors de la création de la commande');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl w-[95vw] max-w-4xl h-[90vh] max-h-[90vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FaShoppingBag className="text-2xl" />
              <div>
                <h2 className="text-xl font-bold">Nouvelle Commande à Emporter</h2>
                <p className="text-green-100">Création rapide sans livraison</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Informations client */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <FaUser className="mr-2 text-blue-600" />
                Informations Client
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du client *
                  </label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nom complet"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone (optionnel)
                  </label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+237 6XX XXX XXX"
                  />
                </div>
              </div>
            </div>

            {/* Sélection des articles */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Articles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => {
                  const price = typeof item.price === 'string' 
                    ? parseFloat(item.price.replace(/\./g, '')) || 0 
                    : Number(item.price) || 0;
                  const quantity = selectedItems[item.id] || 0;
                  
                  return (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{price.toLocaleString()} FCFA</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item.id, -1)}
                            disabled={quantity === 0}
                            className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <FaMinus className="text-xs" />
                          </button>
                          <span className="w-8 text-center font-medium">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item.id, 1)}
                            className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"
                          >
                            <FaPlus className="text-xs" />
                          </button>
                        </div>
                        
                        {quantity > 0 && (
                          <div className="text-sm font-medium text-green-600">
                            {(price * quantity).toLocaleString()} FCFA
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Moyen de paiement */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Moyen de Paiement</h3>
              
              {/* Sélection du type de paiement */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {paymentMethods.map(method => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-3 rounded-lg border-2 transition-colors flex items-center justify-center space-x-2 ${
                        paymentMethod === method.id
                          ? `border-${method.color}-500 bg-${method.color}-50 text-${method.color}-700`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon />
                      <span className="font-medium">{method.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Détails Mobile Money */}
              {paymentMethod === 'mobile_money' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opérateur
                    </label>
                    <div className="flex space-x-3">
                      {mobileProviders.map(provider => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => setPaymentDetails(prev => ({ ...prev, mobileProvider: provider.id }))}
                          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                            paymentDetails.mobileProvider === provider.id
                              ? `border-${provider.color}-500 bg-${provider.color}-50 text-${provider.color}-700`
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {provider.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ID de Transaction *
                    </label>
                    <input
                      type="text"
                      value={paymentDetails.transactionId}
                      onChange={(e) => setPaymentDetails(prev => ({ ...prev, transactionId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: MP240101.1234.A12345"
                      required={paymentMethod === 'mobile_money'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer avec total et actions */}
          <div className="border-t bg-gray-50 p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="text-lg">
                <span className="text-gray-600">Total: </span>
                <span className="font-bold text-2xl text-green-600">
                  {orderTotal.toLocaleString()} FCFA
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {Object.keys(selectedItems).length} article(s) sélectionné(s)
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || Object.keys(selectedItems).length === 0}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Création...</span>
                  </>
                ) : (
                  <>
                    <FaCheck />
                    <span>Créer la Commande</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default TakeawayOrderForm;
