import { useState, useEffect, useMemo, useCallback } from 'react';
import { auth, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

// Constants used by the points system
const LOYALTY_THRESHOLD = 5000;
const FIRST_RATE = 0.1; // reserved for future use
const NORMAL_RATE = 0.05;
const CREDIT_PER_POINT = 100;
const DEFAULT_DELIVERY_FEE = 1000;

export function useCartPoints(cartTotal, onPointsChange) {
  const [userPoints, setUserPoints] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // Fetch user points once
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

  const earnedPoints = useMemo(() => {
    if (cartTotal < LOYALTY_THRESHOLD) return 0;
    const baseTotal = Math.max(0, Number(cartTotal || 0) - DEFAULT_DELIVERY_FEE);
    const rate = NORMAL_RATE; // business rule could evolve
    return Math.floor((baseTotal * rate) / CREDIT_PER_POINT);
  }, [cartTotal]);

  const maxPointsToUse = useMemo(() => {
    return Math.min(userPoints, Math.floor((Number(cartTotal || 0)) / CREDIT_PER_POINT));
  }, [userPoints, cartTotal]);

  const pointsReduction = useMemo(() => pointsToUse * CREDIT_PER_POINT, [pointsToUse]);

  const handlePointsChange = useCallback((newPoints) => {
    const clampedPoints = Math.max(0, Math.min(newPoints, maxPointsToUse));
    setPointsToUse(clampedPoints);
    onPointsChange && onPointsChange(clampedPoints, clampedPoints * CREDIT_PER_POINT);
  }, [maxPointsToUse, onPointsChange]);

  const toggleInfo = useCallback(() => setShowInfo(prev => !prev), []);

  return {
    state: {
      userPoints,
      pointsToUse,
      loading,
      showInfo,
      earnedPoints,
      maxPointsToUse,
      pointsReduction,
      isAuthenticated: Boolean(auth.currentUser),
    },
    actions: {
      handlePointsChange,
      toggleInfo,
      setShowInfo,
      setPointsToUse,
    },
    constants: {
      CREDIT_PER_POINT,
      LOYALTY_THRESHOLD,
    }
  };
}
