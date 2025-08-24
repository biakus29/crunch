import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * useUserProfile
 * Charge le profil utilisateur depuis Firestore (collection 'usersrestau') et expose les points.
 */
export default function useUserProfile(userId) {
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!userId) {
        setPoints(0);
        return;
      }
      try {
        setLoading(true);
        const ref = doc(db, 'usersrestau', userId);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setPoints(data?.points || 0);
        } else {
          setPoints(0);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Erreur chargement profil');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { points, loading, error };
}
