import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  addDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  validatePromoCode,
  calculatePointsEarned,
  calculatePointsDiscount,
  checkPointsUsability,
  createPointsTransaction,
  LOYALTY_CONFIG
} from '../utils/loyaltyUtils';

/**
 * Hook personnalisé pour gérer les codes promo et points fidélité
 */
export const usePromoCode = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [appliedPromoCode, setAppliedPromoCode] = useState(null);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [pointsDiscount, setPointsDiscount] = useState(0);

  // Écouter l'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        loadUserPoints(user.uid);
      } else {
        setUserPoints(0);
      }
    });
    return unsubscribe;
  }, []);

  // Charger les points de l'utilisateur depuis usersrestau/{uid}.points
  const loadUserPoints = async (userId) => {
    try {
      const userRef = doc(db, 'usersrestau', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const pts = userSnap.data().points || 0;
        setUserPoints(pts);
        // Écoute en temps réel du solde de points
        const unsubscribe = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserPoints(snap.data().points || 0);
          }
        });
        return unsubscribe;
      } else {
        // Aucun document utilisateur trouvé: initialiser localement à 0
        setUserPoints(0);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des points:', err);
      setError("Impossible de charger vos points fidélité");
    }
  };

  /**
   * Valider et appliquer un code promo
   */
  const applyPromoCode = useCallback(async (code, orderAmount) => {
    if (!code || !code.trim()) {
      setError('Veuillez entrer un code promo');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Rechercher le code promo
      const promoQuery = query(
        collection(db, 'promoCodes'),
        where('code', '==', code.toUpperCase().trim())
      );
      const promoSnapshot = await getDocs(promoQuery);

      if (promoSnapshot.empty) {
        setError('Code promo invalide');
        setLoading(false);
        return false;
      }

      const promoDoc = promoSnapshot.docs[0];
      const promoData = { id: promoDoc.id, ...promoDoc.data() };

      // Valider le code promo
      const validation = validatePromoCode(promoData);
      if (!validation.valid) {
        setError(validation.message);
        setLoading(false);
        return false;
      }

      // Calculer la réduction
      let discount = 0;
      if (promoData.discountType === 'percentage') {
        discount = Math.floor(orderAmount * (promoData.discountValue / 100));
      } else if (promoData.discountType === 'fixed') {
        discount = promoData.discountValue;
      }

      // Calculer les points bonus
      const bonusPoints = calculatePointsEarned(orderAmount, promoData);

      setAppliedPromoCode({
        ...promoData,
        discount,
        bonusPoints
      });
      setPromoDiscount(discount);
      
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Erreur lors de l\'application du code promo:', err);
      setError('Erreur lors de la validation du code promo');
      setLoading(false);
      return false;
    }
  }, []);

  /**
   * Retirer le code promo appliqué
   */
  const removePromoCode = useCallback(() => {
    setAppliedPromoCode(null);
    setPromoDiscount(0);
    setError(null);
  }, []);

  /**
   * Utiliser des points fidélité pour une réduction
   */
  const usePoints = useCallback((points, orderAmount) => {
    if (!currentUser) {
      setError('Vous devez être connecté pour utiliser vos points');
      return false;
    }

    const usability = checkPointsUsability(userPoints, orderAmount);
    
    if (!usability.canUse) {
      setError(usability.message);
      return false;
    }

    const pointsToApply = Math.min(points, usability.maxUsablePoints);
    const discount = calculatePointsDiscount(pointsToApply);

    setPointsToUse(pointsToApply);
    setPointsDiscount(discount);
    setError(null);
    
    return true;
  }, [currentUser, userPoints]);

  /**
   * Retirer l'utilisation des points
   */
  const removePointsUsage = useCallback(() => {
    setPointsToUse(0);
    setPointsDiscount(0);
  }, []);

  /**
   * Finaliser l'utilisation du code promo et des points lors de la commande
   */
  const finalizePromoUsage = useCallback(async (orderId, orderAmount) => {
    if (!currentUser) return;

    try {
      await runTransaction(db, async (transaction) => {
        // Mettre à jour l'utilisation du code promo
        if (appliedPromoCode) {
          const promoRef = doc(db, 'promoCodes', appliedPromoCode.id);
          transaction.update(promoRef, {
            usesCount: increment(1),
            lastUsed: serverTimestamp(),
            totalRevenue: increment(orderAmount),
            totalOrders: increment(1)
          });

          // Ajouter les points bonus à l'utilisateur
          if (appliedPromoCode.bonusPoints > 0) {
            const userRef = doc(db, 'usersrestau', currentUser.uid);
            const userSnap = await transaction.get(userRef);
            const currentBalance = userSnap.exists() ? (userSnap.data().points || 0) : 0;
            transaction.update(userRef, {
              points: currentBalance + appliedPromoCode.bonusPoints,
              updatedAt: serverTimestamp()
            });
            // Log transaction points bonus
            const bonusTxRef = doc(collection(db, 'pointsTransactions'));
            transaction.set(bonusTxRef, {
              userId: currentUser.uid,
              orderId,
              pointsAmount: appliedPromoCode.bonusPoints,
              type: 'points_grant',
              status: 'approved',
              message: `Bonus via code ${appliedPromoCode.code}`,
              timestamp: new Date(),
              read: false
            });
          }

          // Créer une entrée de commission pour l'ambassadeur
          if (appliedPromoCode.ambassadorId) {
            const commission = Math.floor(orderAmount * (appliedPromoCode.commissionRate || LOYALTY_CONFIG.DEFAULT_AMBASSADOR_COMMISSION));
            
            transaction.set(doc(collection(db, 'ambassadorCommissions')), {
              ambassadorId: appliedPromoCode.ambassadorId,
              orderId,
              orderAmount,
              commission,
              promoCode: appliedPromoCode.code,
              status: 'pending',
              createdAt: serverTimestamp()
            });
          }
        }

        // Déduire les points utilisés
        if (pointsToUse > 0) {
          const userRef = doc(db, 'usersrestau', currentUser.uid);
          const userSnap = await transaction.get(userRef);
          const currentBalance = userSnap.exists() ? (userSnap.data().points || 0) : 0;
          transaction.update(userRef, {
            points: Math.max(0, currentBalance - pointsToUse),
            updatedAt: serverTimestamp()
          });
          // Log transaction points utilisés
          const usedTxRef = doc(collection(db, 'pointsTransactions'));
          transaction.set(usedTxRef, {
            userId: currentUser.uid,
            orderId,
            pointsAmount: -pointsToUse,
            type: 'points_used',
            status: 'approved',
            discount: pointsDiscount,
            message: `Points utilisés pour réduction de ${pointsDiscount} FCFA`,
            timestamp: new Date(),
            read: false
          });
        }

        // Ajouter les points standards gagnés sur la commande
        const standardPoints = calculatePointsEarned(orderAmount - promoDiscount - pointsDiscount);
        if (standardPoints > 0) {
          const userRef = doc(db, 'usersrestau', currentUser.uid);
          const userSnap = await transaction.get(userRef);
          const currentBalance = userSnap.exists() ? (userSnap.data().points || 0) : 0;
          transaction.update(userRef, {
            points: currentBalance + standardPoints,
            updatedAt: serverTimestamp()
          });
          // Log transaction points gagnés
          const earnTxRef = doc(collection(db, 'pointsTransactions'));
          transaction.set(earnTxRef, {
            userId: currentUser.uid,
            orderId,
            pointsAmount: standardPoints,
            type: 'points_grant',
            status: 'approved',
            message: `Points gagnés sur commande #${orderId.slice(0, 8)}`,
            orderAmount,
            timestamp: new Date(),
            read: false
          });
        }

        // Mettre à jour la commande avec les infos promo/points
        const orderRef = doc(db, 'orders', orderId);
        transaction.update(orderRef, {
          promoCode: appliedPromoCode?.code || null,
          promoDiscount: promoDiscount || 0,
          pointsUsed: pointsToUse || 0,
          pointsDiscount: pointsDiscount || 0,
          pointsEarned: standardPoints + (appliedPromoCode?.bonusPoints || 0),
          totalDiscount: promoDiscount + pointsDiscount,
          finalTotal: orderAmount - promoDiscount - pointsDiscount
        });
      });

      // Réinitialiser après succès
      setAppliedPromoCode(null);
      setPointsToUse(0);
      setPromoDiscount(0);
      setPointsDiscount(0);
      
      return true;
    } catch (err) {
      console.error('Erreur lors de la finalisation:', err);
      setError('Erreur lors de l\'application des réductions');
      return false;
    }
  }, [currentUser, appliedPromoCode, pointsToUse, promoDiscount, pointsDiscount]);

  /**
   * Calculer le total avec réductions
   */
  const calculateFinalTotal = useCallback((subtotal, deliveryFee = 0) => {
    const baseTotal = subtotal + deliveryFee;
    const totalDiscount = promoDiscount + pointsDiscount;
    return Math.max(0, baseTotal - totalDiscount);
  }, [promoDiscount, pointsDiscount]);

  /**
   * Obtenir le résumé des réductions
   */
  const getDiscountSummary = useCallback(() => {
    const summary = {
      hasDiscount: promoDiscount > 0 || pointsDiscount > 0,
      promoCode: appliedPromoCode?.code || null,
      promoDiscount,
      pointsUsed: pointsToUse,
      pointsDiscount,
      totalDiscount: promoDiscount + pointsDiscount,
      bonusPoints: appliedPromoCode?.bonusPoints || 0
    };
    return summary;
  }, [appliedPromoCode, promoDiscount, pointsToUse, pointsDiscount]);

  return {
    // État
    loading,
    error,
    userPoints,
    appliedPromoCode,
    pointsToUse,
    promoDiscount,
    pointsDiscount,
    
    // Actions
    applyPromoCode,
    removePromoCode,
    usePoints,
    removePointsUsage,
    finalizePromoUsage,
    
    // Utilitaires
    calculateFinalTotal,
    getDiscountSummary,
    
    // Setters pour contrôle manuel si nécessaire
    setError,
    setPointsToUse
  };
};

export default usePromoCode;
