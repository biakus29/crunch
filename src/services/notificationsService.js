// src/services/notificationsService.js
// Service central pour notifications (utilisateur, FCM, lecture, purge)
// TODO: Migrer la logique depuis les hooks/pages vers ce service progressivement

import {
  collection,
  query as fsQuery,
  where as fsWhere,
  orderBy as fsOrderBy,
  limit as fsLimit,
  onSnapshot,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { optimizedQuery } from '../utils/firebaseOptimizer';

export async function fetchUserNotifications(userId, { limitCount = 50 } = {}) {
  if (!userId) return [];
  return optimizedQuery('notifications', {
    where: [ ['userId', '==', userId] ],
    orderBy: [['createdAt', 'desc']],
    limit: limitCount,
    useCache: true,
    cacheTTL: 120000,
  });
}

export function subscribeUserNotifications(userId, { limitCount = 50 } = {}, callback, errorCb) {
  if (!userId) return () => {};
  const constraints = [
    fsWhere('userId', '==', userId),
    fsOrderBy('createdAt', 'desc')
  ];
  if (limitCount) constraints.push(fsLimit(limitCount));
  const q = fsQuery(collection(db, 'notifications'), ...constraints);
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(notifs);
  }, errorCb);
}

export async function markAsRead(notificationId) {
  if (!notificationId) return;
  await updateDoc(doc(db, 'notifications', notificationId), { read: true, updatedAt: Timestamp.now() });
}

export async function markAllAsRead(userId) {
  const items = await fetchUserNotifications(userId, { limitCount: 200 });
  await Promise.all(items.filter(n => !n.read).map(n => markAsRead(n.id)));
}

export async function clearAll(userId) {
  // Placeholder: selon stratégie, soit marquer supprimé, soit supprimer réellement
  const items = await fetchUserNotifications(userId, { limitCount: 200 });
  // Ici on pourrait ajouter un champ `deleted: true` (préférable) — on laisse TODO
  return items.length;
}

export default {
  fetchUserNotifications,
  subscribeUserNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
};
