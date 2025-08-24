// src/services/ordersService.js
// Service pour centraliser la logique Firestore/API liée aux commandes
// TODO: Migrer la logique depuis les composants/pages vers ce service progressivement

import {
  collection,
  query as fsQuery,
  where as fsWhere,
  orderBy as fsOrderBy,
  limit as fsLimit,
  getDocs,
  getDoc,
  doc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { optimizedQuery } from '../utils/firebaseOptimizer';

// Exemple: chargement basique des commandes (à adapter au besoin)
export async function fetchOrders({ status = 'all', limitCount = 50 } = {}) {
  const where = [];
  if (status !== 'all') where.push(['status', '==', status]);
  return optimizedQuery('orders', {
    where,
    orderBy: [['timestamp', 'desc']],
    limit: limitCount,
    useCache: true,
    cacheTTL: 120000,
  });
}

// Exemple: écoute temps réel des commandes
export function subscribeOrdersRealtime({ status = 'all', limitCount = 50 } = {}, callback, errorCb) {
  const constraints = [fsOrderBy('timestamp', 'desc')];
  if (status !== 'all') constraints.push(fsWhere('status', '==', status));
  if (limitCount) constraints.push(fsLimit(limitCount));
  const q = fsQuery(collection(db, 'orders'), ...constraints);
  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(orders);
  }, errorCb);
}

export default {
  fetchOrders,
  subscribeOrdersRealtime,
};
