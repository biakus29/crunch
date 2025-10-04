import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CardAnimations } from '../utils/animationSystem';
import { Star, Sparkles } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ProductPoints = ({ total, isFirstOrder = false }) => {
  const [isNewUser, setIsNewUser] = useState(false);
  const [checked, setChecked] = useState(false);

  // Determine if user is new: logged-in and has 0 points (or no user doc)
  useEffect(() => {
    const checkUser = async () => {
      try {
        if (!auth.currentUser) {
          // Not logged-in: do NOT show the promo (strict interpretation)
          setIsNewUser(false);
          return;
        }
        const ref = doc(db, 'usersrestau', auth.currentUser.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          // No user doc yet: consider as new user
          setIsNewUser(true);
        } else {
          const pts = snap.data().points || 0;
          setIsNewUser(pts === 0);
        }
      } catch (e) {
        // On error, be conservative and hide the promo
        console.error('ProductPoints: failed to check user state', e);
        setIsNewUser(false);
      } finally {
        setChecked(true);
      }
    };
    checkUser();
  }, []);

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

  if (!checked || !isNewUser) return null;

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