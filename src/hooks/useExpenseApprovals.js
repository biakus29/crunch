import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';

export const useExpenseApprovals = (currentRestaurantId, userRole) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seuls les comptables et gérants peuvent voir les demandes
    if (userRole !== 'accountant' && userRole !== 'manager') {
      setLoading(false);
      return;
    }

    // Créer la requête selon les permissions
    const requestsQuery = currentRestaurantId
      ? query(
          collection(db, 'expenseDeletionRequests'),
          where('restaurantId', '==', currentRestaurantId),
          where('status', '==', 'pending')
        )
      : query(
          collection(db, 'expenseDeletionRequests'),
          where('status', '==', 'pending')
        );

    // Écouter les changements en temps réel
    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        setPendingCount(snapshot.docs.length);
        setLoading(false);
      },
      (error) => {
        console.error('Erreur écoute demandes:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentRestaurantId, userRole]);

  return { pendingCount, loading };
};
