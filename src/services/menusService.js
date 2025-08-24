// src/services/menusService.js
// Service pour centraliser la logique de chargement/filtrage des menus
// TODO: Migrer la logique depuis les hooks/pages (useMenus, useMenuFilters) si pertinent

import {
  collection,
  query as fsQuery,
  where as fsWhere,
  orderBy as fsOrderBy,
  limit as fsLimit,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { optimizedQuery } from '../utils/firebaseOptimizer';

export async function fetchMenus({ categoryId = 'all', search = '', limitCount = 100 } = {}) {
  const where = [];
  if (categoryId !== 'all') where.push(['categoryId', '==', categoryId]);
  // NB: pour la recherche texte, prévoir un index/algolia ou un champ normalisé; ici fallback client-side
  const menus = await optimizedQuery('menus', {
    where,
    orderBy: [['priority', 'desc']],
    limit: limitCount,
    useCache: true,
    cacheTTL: 120000,
  });
  if (!search) return menus;
  const s = search.toLowerCase();
  return menus.filter(m => (m.name || '').toLowerCase().includes(s));
}

export function subscribeMenus({ categoryId = 'all', limitCount = 100 } = {}, callback, errorCb) {
  const constraints = [];
  if (categoryId !== 'all') constraints.push(fsWhere('categoryId', '==', categoryId));
  constraints.push(fsOrderBy('priority', 'desc'));
  if (limitCount) constraints.push(fsLimit(limitCount));
  const q = fsQuery(collection(db, 'menus'), ...constraints);
  return onSnapshot(q, (snap) => {
    const menus = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(menus);
  }, errorCb);
}

export default {
  fetchMenus,
  subscribeMenus,
};
