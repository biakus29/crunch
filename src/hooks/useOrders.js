import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * useOrders
 * Abonne les commandes de l'utilisateur courant.
 */
export default function useOrders(userId) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setOrders([]);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'orders'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err?.message || 'Erreur commandes');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  return { orders, loading, error };
}
