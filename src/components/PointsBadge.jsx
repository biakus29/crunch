import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CardAnimations, FoodAnimations } from '../utils/animationSystem';
import { Star, Sparkles } from 'lucide-react';

const PointsBadge = () => {
  const [userPoints, setUserPoints] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserPoints = async () => {
      try {
        if (auth.currentUser) {
          const userDoc = await getDoc(doc(db, 'usersrestau', auth.currentUser.uid));
          if (userDoc.exists()) {
            const points = userDoc.data().points || 0;
            setUserPoints(points);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des points:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPoints();
  }, []);

  if (!auth.currentUser || loading) {
    return null;
  }

  return (
    <div className="relative">
      <motion.button
        className="flex items-center space-x-2 bg-green-100 hover:bg-green-200 px-3 py-2 rounded-full transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
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
          <Star className="w-4 h-4 text-green-600" />
        </motion.div>
        <span className="text-sm font-semibold text-green-700">
          {userPoints}
        </span>
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
          <Sparkles className="w-3 h-3 text-green-500" />
        </motion.div>
      </motion.button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-48"
          >
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Star className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-lg font-bold text-green-600">{userPoints} points</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Équivaut à {userPoints * 100} FCFA
              </p>
              <div className="text-xs text-gray-500">
                <p>• 1 point = 100 FCFA</p>
                <p>• Utilisable sur vos commandes</p>
                <p>• Frais de livraison annulés</p>
              </div>
            </div>
            
            {/* Flèche du tooltip */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PointsBadge; 