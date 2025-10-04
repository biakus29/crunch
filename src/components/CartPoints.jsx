import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Sparkles, Gift } from 'lucide-react';
import { useCartPoints } from '../hooks/cart/useCartPoints';

const CartPoints = ({ cartTotal, onPointsChange }) => {
  const { state, actions } = useCartPoints(cartTotal, onPointsChange);
  const {
    userPoints,
    pointsToUse,
    loading,
    showInfo,
    earnedPoints,
    maxPointsToUse,
    pointsReduction,
    isAuthenticated,
  } = state;
  const { handlePointsChange, toggleInfo } = actions;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <motion.div
          className="w-6 h-6 border-2 border-green-200 border-t-green-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <motion.div
        className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center space-x-2 mb-2">
          <Star className="w-5 h-5 text-green-600" />
          <span className="font-semibold text-green-800">Programme de fidélité</span>
        </div>
        <p className="text-sm text-green-700">
          Connectez-vous pour utiliser vos points de fidélité et gagner des points sur cette commande !
        </p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4 mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Star className="w-5 h-5 text-green-600" />
            </motion.div>
            <span className="font-semibold text-green-800">Points de fidélité</span>
          </div>
          <motion.button
            onClick={toggleInfo}
            className="text-green-600 hover:text-green-800"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Sparkles className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Informations détaillées */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-3 bg-white rounded-lg"
            >
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{userPoints}</div>
                  <div className="text-xs text-gray-600">Points disponibles</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{earnedPoints}</div>
                  <div className="text-xs text-gray-600">Points gagnés</div>
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                <p>• 1 point = 100 FCFA de réduction</p>
                <p>• Frais de livraison annulés si points utilisés</p>
                <p>• Points validés après confirmation de commande</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Utilisation des points */}
        {userPoints > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Utiliser des points</span>
              <span className="text-xs text-gray-500">
                Max: {maxPointsToUse} points
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <motion.button
                onClick={() => handlePointsChange(pointsToUse - 1)}
                disabled={pointsToUse <= 0}
                className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center disabled:bg-gray-300"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                -
              </motion.button>
              
              <div className="flex-1 text-center">
                <span className="text-lg font-bold text-green-600">{pointsToUse}</span>
                <span className="text-sm text-gray-600 ml-1">points</span>
              </div>
              
              <motion.button
                onClick={() => handlePointsChange(pointsToUse + 1)}
                disabled={pointsToUse >= maxPointsToUse}
                className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center disabled:bg-gray-300"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                +
              </motion.button>
            </div>
            
            {pointsReduction > 0 && (
              <motion.div
                className="mt-2 text-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <span className="text-sm text-green-600 font-semibold">
                  Réduction: {pointsReduction} FCFA
                </span>
              </motion.div>
            )}
          </div>
        )}

        {/* Points gagnés sur cette commande */}
        {earnedPoints > 0 && (
          <motion.div
            className="flex items-center justify-between p-2 bg-green-200 rounded-lg"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center space-x-2">
              <Gift className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Points gagnés sur cette commande
              </span>
            </div>
            <motion.div
              className="text-lg font-bold text-green-600"
              animate={{ 
                scale: [1, 1.2, 1],
                color: ["#059669", "#10B981", "#059669"]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              +{earnedPoints}
            </motion.div>
          </motion.div>
        )}

        {/* Barre de progression vers le seuil */}
        {cartTotal < 5000 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progression vers le seuil</span>
              <span>{5000 - cartTotal} FCFA restants</span>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (cartTotal / 5000) * 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Commandez pour {5000 - cartTotal} FCFA de plus pour gagner des points !
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default CartPoints; 