import { useEffect, useState } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * useFCM
 * Enregistre le token FCM pour l'utilisateur et le stocke dans Firestore (collection 'usersrestau').
 */
export default function useFCM(userId) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!userId) {
        setToken(null);
        return;
      }
      try {
        setLoading(true);
        const messaging = getMessaging();
        const t = await getToken(messaging, {
          vapidKey: 'BHnVLhfreD5NmV_RYjOvSkJoh2NtJNV1hFOxi__f-SFz9Cf_iatVJC807jWukr6TicgDNHVx-rErZkWBA84rq88',
        });
        if (cancelled) return;
        setToken(t);
        await setDoc(doc(db, 'usersrestau', userId), { fcmToken: t }, { merge: true });
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Erreur FCM');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { token, loading, error };
}
