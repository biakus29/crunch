import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Check, Plus, Minus } from 'lucide-react';
import { useCart } from '../context/cartcontext';
import { normalizePrice, computeTotal } from '../features/cart/utils';
import { groupExtrasByGroupId, validateRequiredGroups } from '../shared/extras';

const AddToCartModal = ({ 
  isOpen, 
  onClose, 
  item, 
  extraLists = [], 
  onSuccess = () => {},
  showQuantitySelector = true,
  defaultQuantity = 1 
}) => {
  const { addToCart } = useCart();
  const [selectedExtras, setSelectedExtras] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [validationError, setValidationError] = useState(null);

  // Indexation des extraLists pour des recherches rapides
  const extraListsById = useMemo(
    () => extraLists.reduce((acc, list) => ({ ...acc, [list.id]: list }), {}),
    [extraLists]
  );

  // Initialisation des tailles par défaut
  useEffect(() => {
    if (item && item.priceType === 'sizes' && item.sizes && Object.keys(item.sizes).length > 0) {
      const firstValidSize = Object.keys(item.sizes).find(
        size => item.sizes[size] && normalizePrice(item.sizes[size]) > 0
      );
      if (firstValidSize) {
        setSelectedSizes({ [item.id]: firstValidSize });
      }
    }
  }, [item]);

  // Reset des états quand l'item change
  useEffect(() => {
    if (item) {
      setSelectedExtras({});
      setQuantity(defaultQuantity);
      setValidationError(null);
    }
  }, [item, defaultQuantity]);

  // Fonctions centralisées: normalizePrice, computeTotal

  // Validation des extras obligatoires (standardisée)
  const validateExtras = () => {
    if (!item) return { isValid: false, error: 'Aucun article sélectionné' };
    if (item.priceType === 'sizes' && !selectedSizes[item.id]) {
      return { isValid: false, error: 'Veuillez sélectionner une taille.' };
    }
    // Construire une carte d'extras normalisés par groupe (extraListId)
    const allExtras = [];
    (item.extraLists || []).forEach((extraListId) => {
      const list = extraListsById[extraListId];
      if (!list) return;
      (list.extraListElements || []).forEach((el, index) => {
        allExtras.push({
          id: `${extraListId}:${index}`,
          name: el.name,
          price: el.price,
          groupId: extraListId,
          required: Boolean(el.required),
        });
      });
    });
    const groups = groupExtrasByGroupId(allExtras);
    // Construire la sélection par id normalisé
    const selectedById = {};
    Object.entries(selectedExtras).forEach(([extraListId, indexes = []]) => {
      indexes.forEach((i) => {
        selectedById[`${extraListId}:${i}`] = true;
      });
    });
    const res = validateRequiredGroups({ groups, selectedById });
    if (!res.valid) {
      return { isValid: false, error: 'Veuillez sélectionner les éléments obligatoires.' };
    }
    return { isValid: true, error: null };
  };

  // Calcul du prix total
  const calculateTotalPrice = () => {
    if (!item) return 0;
    // Construire la liste des extras sélectionnés avec leur prix
    const selectedExtrasList = Object.entries(selectedExtras).flatMap(([extraListId, indexes]) => {
      const l = extraListsById[extraListId];
      if (!l) return [];
      return indexes
        .map((i) => l.extraListElements?.[i])
        .filter(Boolean);
    });
    const total = computeTotal({
      item,
      quantity,
      selectedSizeKey: item.priceType === 'sizes' ? selectedSizes[item.id] : null,
      selectedExtras: selectedExtrasList,
    });
    return total;
  };

  // Gestion de la quantité
  const handleQuantityChange = (delta) => {
    setQuantity(prev => Math.max(1, prev + delta));
  };

  // Ajout au panier
  const handleAddToCart = () => {
    const validation = validateExtras();
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    const totalPrice = calculateTotalPrice();
    const cartItem = {
      ...item,
      restaurantId: item.restaurantId || 'default_restaurant_id',
      quantity,
      selectedExtras,
      selectedSize: item.priceType === 'sizes' ? selectedSizes[item.id] : null,
      price: totalPrice / quantity,
    };

    addToCart(cartItem);
    
    // Callback de succès
    const successMessage = `${item.name}${
      item.priceType === 'sizes' && selectedSizes[item.id] 
        ? ` (${selectedSizes[item.id]})` 
        : ''
    } ajouté au panier !`;
    
    onSuccess(successMessage);

    // Tracking Facebook Pixel
    if (window.fbq) {
      window.fbq('track', 'AddToCart', {
        content_ids: [item.id],
        content_name: item.name,
        content_type: 'product',
        value: totalPrice,
        currency: 'XAF',
        num_items: quantity,
      });
    }

    // Fermeture du modal
    onClose();
  };

  if (!isOpen || !item) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête */}
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Description */}
          <div className="mb-4">
            <p className="text-gray-600 text-sm">{item.description}</p>
          </div>

          {/* Erreur de validation */}
          {validationError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <p className="text-red-600 text-sm">{validationError}</p>
            </motion.div>
          )}

          {/* Sélection de taille si applicable */}
          {item.priceType === 'sizes' && item.sizes && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2">Choisissez votre taille</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(item.sizes).map(([size, price]) => (
                  <motion.button
                    key={size}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedSizes(prev => ({ ...prev, [item.id]: size }));
                      setValidationError(null);
                    }}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedSizes[item.id] === size
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="font-medium">{size}</div>
                    <div className="text-sm text-gray-600">
                      {normalizePrice(price).toLocaleString()} FCFA
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Sélection des extras */}
          {item.extraLists && item.extraLists.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2">Personnalisez votre plat</h4>
              {item.extraLists.map((extraListId) => {
                const extraList = extraListsById[extraListId];
                if (!extraList) return null;

                return (
                  <div key={extraListId} className="mb-3">
                    <h5 className="text-sm font-medium text-gray-600 mb-2">
                      {extraList.name}
                      {extraList.extraListElements?.some(el => el.required) && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </h5>
                    <div className="space-y-2">
                      {extraList.extraListElements?.map((element, index) => (
                        <motion.label
                          key={index}
                          whileHover={{ scale: 1.02 }}
                          className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:border-green-300 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedExtras[extraListId]?.includes(index) || false}
                            onChange={(e) => {
                              const current = selectedExtras[extraListId] || [];
                              const newSelection = e.target.checked
                                ? [...current, index]
                                : current.filter(i => i !== index);
                              setSelectedExtras(prev => ({
                                ...prev,
                                [extraListId]: newSelection
                              }));
                              setValidationError(null);
                            }}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="flex-1 text-sm">{element.name}</span>
                          {element.price && (
                            <span className="text-sm text-gray-600">
                              +{normalizePrice(element.price).toLocaleString()} FCFA
                            </span>
                          )}
                          {element.required && (
                            <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                              Obligatoire
                            </span>
                          )}
                        </motion.label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sélecteur de quantité */}
          {showQuantitySelector && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-700 mb-2">Quantité</h4>
              <div className="flex items-center space-x-3">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleQuantityChange(-1)}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </motion.button>
                <span className="text-lg font-semibold px-4">{quantity}</span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleQuantityChange(1)}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          )}

          {/* Prix total */}
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-800">Total</span>
              <span className="text-2xl font-bold text-green-600">
                {calculateTotalPrice().toLocaleString()} FCFA
              </span>
            </div>
          </div>

          {/* Bouton Commander */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 10px 25px rgba(34, 197, 94, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddToCart}
            className="relative w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              initial={false}
            />
            <motion.span
              className="relative z-10 flex items-center justify-center"
              animate={{ x: [0, 2, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Ajouter à ma commande
            </motion.span>
            <motion.div
              className="absolute inset-0 bg-white opacity-20"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            />
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AddToCartModal;
