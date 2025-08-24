import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, where, deleteDoc, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * useUserNotifications
 * Abonne les notifications utilisateur et expose helpers: markAsRead, markAllAsRead, clearAll.
 */
export default function useUserNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.() || new Date(0) }))
          .sort((a, b) => b.timestamp - a.timestamp);
        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || 'Erreur notifications');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAsRead = async (notificationId) => {
    if (!notificationId) return;
    try {
      const ref = doc(db, 'notifications', notificationId);
      await updateDoc(ref, { read: true });
    } catch (e) {
      // noop: l'état se resync via onSnapshot
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.read);
      await Promise.all(unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (e) {
      // noop
    }
  };

  const clearAll = async () => {
    if (!userId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  };

  return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead, clearAll };
}
