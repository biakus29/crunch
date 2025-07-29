import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardAnimations } from '../utils/animationSystem';
import { 
  Gift, 
  Tag, 
  Percent, 
  Fire, 
  Zap, 
  Clock, 
  Check,
  X,
  Sparkles
} from 'lucide-react';

const CartPromotions = ({ cartTotal, onPromoApplied }) => {
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');

  // Promotions disponibles
  const availablePromos = [
    {
      code: 'POPULAR50',
      name: 'Offre Spéciale -50%',
      description: 'Sur tous les plats populaires',
      discount: 0.5,
      minTotal: 5000,
      validUntil: '2024-12-31',
      icon: Fire,
      color: 'from-red-500 to-pink-500'
    },
    {
      code: 'FREESHIP',
      name: 'Livraison Gratuite',
      description: 'Commande minimum 8000 FCFA',
      freeShipping: true,
      minTotal: 8000,
      validUntil: '2024-12-25',
      icon: Gift,
      color: 'from-green-500 to-emerald-500'
    },
    {
      code: 'FAMILY30',
      name: 'Menu Famille -30%',
      description: 'Parfait pour 4-6 personnes',
      discount: 0.3,
      minTotal: 10000,
      validUntil: '2024-12-28',
      icon: Sparkles,
      color: 'from-purple-500 to-indigo-500'
    },
    {
      code: 'FLASH40',
      name: 'Flash Sale -40%',
      description: 'Seulement aujourd\'hui',
      discount: 0.4,
      minTotal: 3000,
      validUntil: '2024-12-20',
      icon: Zap,
      color: 'from-orange-500 to-red-500'
    }
  ];

  const handleApplyPromo = () => {
    const promo = availablePromos.find(p => p.code === promoCode.toUpperCase());
    
    if (!promo) {
      alert('Code promo invalide');
      return;
    }

    if (cartTotal < promo.minTotal) {
      alert(`Commande minimum de ${promo.minTotal} FCFA requise`);
      return;
    }

    setAppliedPromo(promo);
    setShowPromoInput(false);
    setPromoCode('');
    
    // Calculer la réduction
    let discount = 0;
    if (promo.discount) {
      discount = cartTotal * promo.discount;
    }
    
    onPromoApplied && onPromoApplied(promo, discount);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    onPromoApplied && onPromoApplied(null, 0);
  };

  const calculateDiscount = () => {
    if (!appliedPromo) return 0;
    
    if (appliedPromo.discount) {
      return cartTotal * appliedPromo.discount;
    }
    return 0;
  };

  const discount = calculateDiscount();

  return (
    <div className="space-y-4">
      {/* Promotions disponibles */}
      {!appliedPromo && (
        <motion.div
          className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Gift className="w-5 h-5 text-purple-600" />
              </motion.div>
              <span className="font-semibold text-purple-800">Promotions disponibles</span>
            </div>
            <motion.button
              onClick={() => setShowPromoInput(!showPromoInput)}
              className="text-purple-600 hover:text-purple-800 text-sm font-semibold"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {showPromoInput ? 'Annuler' : 'Ajouter un code'}
            </motion.button>
          </div>

          <AnimatePresence>
            {showPromoInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3"
              >
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Entrez votre code promo"
                    className="flex-1 px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <motion.button
                    onClick={handleApplyPromo}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Appliquer
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Liste des promotions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availablePromos.map((promo, index) => (
              <motion.div
                key={promo.code}
                className="bg-white rounded-lg p-3 border border-purple-100"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <div className="flex items-start space-x-2">
                  <div className={`w-8 h-8 bg-gradient-to-r ${promo.color} rounded-full flex items-center justify-center`}>
                    <promo.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-sm">{promo.name}</h4>
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-bold">
                        {promo.discount ? `-${promo.discount * 100}%` : 'GRATUIT'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{promo.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Min: {promo.minTotal} FCFA</span>
                      <span className="text-xs text-gray-500">Code: {promo.code}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Promotion appliquée */}
      <AnimatePresence>
        {appliedPromo && (
          <motion.div
            className={`bg-gradient-to-r ${appliedPromo.color} text-white rounded-lg p-4`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <appliedPromo.icon className="w-6 h-6" />
                </motion.div>
                <div>
                  <h4 className="font-bold">{appliedPromo.name}</h4>
                  <p className="text-sm opacity-90">{appliedPromo.description}</p>
                </div>
              </div>
              <motion.button
                onClick={handleRemovePromo}
                className="bg-white bg-opacity-20 p-2 rounded-full hover:bg-opacity-30"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
            
            {discount > 0 && (
              <motion.div
                className="mt-3 text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <span className="text-lg font-bold">
                  Économie: {discount.toLocaleString()} FCFA
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CartPromotions; 