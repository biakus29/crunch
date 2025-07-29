import React from 'react';
import { motion } from 'framer-motion';
import { CardAnimations } from '../utils/animationSystem';
import { Star, Sparkles } from 'lucide-react';

const ProductPoints = ({ total, isFirstOrder = false }) => {
  // Calcul des points selon votre système
  const LOYALTY_THRESHOLD = 5000;
  const FIRST_RATE = 0.1;
  const NORMAL_RATE = 0.05;
  const CREDIT_PER_POINT = 100;

  const calculatePoints = (total) => {
    if (total < LOYALTY_THRESHOLD) return 0;
    
    const deliveryFee = 1000; // Frais de livraison estimés
    const baseTotal = total - deliveryFee;
    const rate = isFirstOrder ? FIRST_RATE : NORMAL_RATE;
    return Math.floor((baseTotal * rate) / CREDIT_PER_POINT);
  };

  const points = calculatePoints(total);
  const pointsValue = points * 100; // 1 point = 100 FCFA

  if (points === 0) return null;

  return (
    <motion.div
      className="absolute top-2 left-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-2 py-1 rounded-full text-xs font-bold z-10 flex items-center space-x-1"
      {...CardAnimations.promotionBadge}
    >
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
        <Star className="w-3 h-3" />
      </motion.div>
      <span>+{points} pts</span>
      <motion.div
        animate={{ 
          opacity: [0.5, 1, 0.5],
          scale: [1, 1.2, 1]
        }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Sparkles className="w-3 h-3" />
      </motion.div>
    </motion.div>
  );
};

export default ProductPoints; 