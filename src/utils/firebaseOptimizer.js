/**
 * Utilitaires d'optimisation pour Firebase
 * Améliore les performances des requêtes et réduit les coûts
 */

import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import React from 'react';

// Cache en mémoire pour les requêtes fréquentes
const queryCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Pool de connexions pour éviter les requêtes simultanées identiques
const pendingQueries = new Map();

/**
 * Gestionnaire de cache pour les requêtes Firebase
 */
class FirebaseCache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  set(key, data, ttl = CACHE_DURATION) {
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now() + ttl);
  }

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() > timestamp) {
      this.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  size() {
    return this.cache.size;
  }
}

const firebaseCache = new FirebaseCache();

/**
 * Génère une clé de cache unique pour une requête
 */
function generateCacheKey(collectionName, queryParams = {}) {
  const params = JSON.stringify(queryParams);
  return `${collectionName}:${params}`;
}

/**
 * Requête optimisée avec mise en cache
 * @param {string} collectionName - Nom de la collection
 * @param {Object} options - Options de requête
 * @returns {Promise<Array>} Données de la collection
 */
export const optimizedQuery = async (collectionName, options = {}) => {
  const {
    where: whereClause,
    orderBy: orderByClause,
    limit: limitClause,
    useCache = true,
    cacheTTL = CACHE_DURATION
  } = options;

  // Générer la clé de cache
  const cacheKey = generateCacheKey(collectionName, options);

  // Vérifier le cache si activé
  if (useCache) {
    const cachedData = firebaseCache.get(cacheKey);
    if (cachedData) {
      console.log(`📦 Cache hit pour ${collectionName}`);
      return cachedData;
    }
  }

  // Vérifier si une requête identique est en cours
  if (pendingQueries.has(cacheKey)) {
    console.log(`⏳ Requête en cours pour ${collectionName}, attente...`);
    return await pendingQueries.get(cacheKey);
  }

  // Créer la requête
  let queryRef = collection(db, collectionName);

  // Appliquer les filtres
  if (whereClause && Array.isArray(whereClause)) {
    whereClause.forEach(([field, operator, value]) => {
      queryRef = query(queryRef, where(field, operator, value));
    });
  }

  // Appliquer le tri
  if (orderByClause) {
    if (Array.isArray(orderByClause)) {
      orderByClause.forEach(([field, direction = 'asc']) => {
        queryRef = query(queryRef, orderBy(field, direction));
      });
    } else {
      queryRef = query(queryRef, orderBy(orderByClause));
    }
  }

  // Appliquer la limite
  if (limitClause) {
    queryRef = query(queryRef, limit(limitClause));
  }

  // Exécuter la requête
  const queryPromise = getDocs(queryRef)
    .then(snapshot => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Mettre en cache si activé
      if (useCache) {
        firebaseCache.set(cacheKey, data, cacheTTL);
      }

      console.log(`✅ Requête ${collectionName} terminée: ${data.length} documents`);
      return data;
    })
    .catch(error => {
      console.error(`❌ Erreur requête ${collectionName}:`, error);
      throw error;
    })
    .finally(() => {
      // Supprimer de la liste des requêtes en cours
      pendingQueries.delete(cacheKey);
    });

  // Ajouter à la liste des requêtes en cours
  pendingQueries.set(cacheKey, queryPromise);

  return await queryPromise;
};

/**
 * Récupération optimisée d'un document unique
 * @param {string} collectionName - Nom de la collection
 * @param {string} docId - ID du document
 * @param {Object} options - Options
 * @returns {Promise<Object|null>} Document ou null
 */
export const optimizedGetDoc = async (collectionName, docId, options = {}) => {
  const { useCache = true, cacheTTL = CACHE_DURATION } = options;
  const cacheKey = `${collectionName}:${docId}`;

  // Vérifier le cache
  if (useCache) {
    const cachedData = firebaseCache.get(cacheKey);
    if (cachedData) {
      console.log(`📦 Cache hit pour document ${collectionName}/${docId}`);
      return cachedData;
    }
  }

  // Vérifier les requêtes en cours
  if (pendingQueries.has(cacheKey)) {
    return await pendingQueries.get(cacheKey);
  }

  const queryPromise = getDoc(doc(db, collectionName, docId))
    .then(docSnap => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        
        if (useCache) {
          firebaseCache.set(cacheKey, data, cacheTTL);
        }
        
        return data;
      }
      return null;
    })
    .catch(error => {
      console.error(`❌ Erreur récupération document ${collectionName}/${docId}:`, error);
      throw error;
    })
    .finally(() => {
      pendingQueries.delete(cacheKey);
    });

  pendingQueries.set(cacheKey, queryPromise);
  return await queryPromise;
};

/**
 * Batch de requêtes pour optimiser les opérations multiples
 * @param {Array} operations - Liste des opérations
 * @returns {Promise<Array>} Résultats des opérations
 */
export const batchQueries = async (operations) => {
  console.log(`🔄 Exécution de ${operations.length} requêtes en batch`);
  
  const results = await Promise.allSettled(
    operations.map(async (operation) => {
      const { type, collection: collectionName, docId, options } = operation;
      
      switch (type) {
        case 'get':
          return await optimizedGetDoc(collectionName, docId, options);
        case 'query':
          return await optimizedQuery(collectionName, options);
        default:
          throw new Error(`Type d'opération non supporté: ${type}`);
      }
    })
  );

  // Traiter les résultats
  const successfulResults = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successfulResults.push(result.value);
    } else {
      errors.push({ index, error: result.reason });
    }
  });

  if (errors.length > 0) {
    console.warn(`⚠️ ${errors.length} erreurs dans le batch:`, errors);
  }

  console.log(`✅ Batch terminé: ${successfulResults.length}/${operations.length} succès`);
  return successfulResults;
};

/**
 * Écriture en batch pour optimiser les opérations d'écriture
 * @param {Array} writes - Liste des opérations d'écriture
 * @returns {Promise<void>}
 */
export const batchWrites = async (writes) => {
  if (writes.length === 0) return;

  console.log(`✍️ Écriture en batch de ${writes.length} opérations`);
  
  const batch = writeBatch(db);
  
  writes.forEach(({ type, collection: collectionName, docId, data }) => {
    const docRef = doc(db, collectionName, docId);
    
    switch (type) {
      case 'set':
        batch.set(docRef, data);
        break;
      case 'update':
        batch.update(docRef, data);
        break;
      case 'delete':
        batch.delete(docRef);
        break;
      default:
        console.warn(`Type d'écriture non supporté: ${type}`);
    }
  });

  try {
    await batch.commit();
    console.log(`✅ Batch d'écriture terminé avec succès`);
    
    // Invalider le cache pour les collections affectées
    const affectedCollections = [...new Set(writes.map(w => w.collection))];
    affectedCollections.forEach(collectionName => {
      invalidateCache(collectionName);
    });
  } catch (error) {
    console.error(`❌ Erreur lors de l'écriture en batch:`, error);
    throw error;
  }
};

/**
 * Listener optimisé avec gestion automatique du cache
 * @param {string} collectionName - Nom de la collection
 * @param {Object} options - Options de requête
 * @param {Function} callback - Fonction de callback
 * @returns {Function} Fonction de désabonnement
 */
export const optimizedListener = (collectionName, options, callback) => {
  let queryRef = collection(db, collectionName);

  // Appliquer les filtres comme dans optimizedQuery
  const { where: whereClause, orderBy: orderByClause, limit: limitClause } = options;

  if (whereClause && Array.isArray(whereClause)) {
    whereClause.forEach(([field, operator, value]) => {
      queryRef = query(queryRef, where(field, operator, value));
    });
  }

  if (orderByClause) {
    if (Array.isArray(orderByClause)) {
      orderByClause.forEach(([field, direction = 'asc']) => {
        queryRef = query(queryRef, orderBy(field, direction));
      });
    } else {
      queryRef = query(queryRef, orderBy(orderByClause));
    }
  }

  if (limitClause) {
    queryRef = query(queryRef, limit(limitClause));
  }

  console.log(`👂 Listener activé pour ${collectionName}`);

  return onSnapshot(queryRef, 
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Mettre à jour le cache
      const cacheKey = generateCacheKey(collectionName, options);
      firebaseCache.set(cacheKey, data);

      callback(data);
    },
    (error) => {
      console.error(`❌ Erreur listener ${collectionName}:`, error);
    }
  );
};

/**
 * Invalider le cache pour une collection
 * @param {string} collectionName - Nom de la collection
 */
export const invalidateCache = (collectionName) => {
  const keysToDelete = [];
  
  for (const [key] of firebaseCache.cache) {
    if (key.startsWith(`${collectionName}:`)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => firebaseCache.delete(key));
  console.log(`🗑️ Cache invalidé pour ${collectionName}: ${keysToDelete.length} entrées supprimées`);
};

/**
 * Statistiques du cache
 */
export const getCacheStats = () => {
  return {
    size: firebaseCache.size(),
    pendingQueries: pendingQueries.size,
    entries: Array.from(firebaseCache.cache.keys())
  };
};

/**
 * Nettoyer le cache
 */
export const clearCache = () => {
  firebaseCache.clear();
  console.log('🧹 Cache Firebase nettoyé');
};

/**
 * Hook React pour les requêtes optimisées
 * @param {string} collectionName - Nom de la collection
 * @param {Object} options - Options de requête
 * @returns {Object} État de la requête
 */
export const useOptimizedQuery = (collectionName, options = {}) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await optimizedQuery(collectionName, options);
        
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [collectionName, JSON.stringify(options)]);

  return { data, loading, error };
};

// Nettoyage automatique du cache toutes les 10 minutes
setInterval(() => {
  const now = Date.now();
  const keysToDelete = [];
  
  for (const [key, timestamp] of firebaseCache.timestamps) {
    if (now > timestamp) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => firebaseCache.delete(key));
  
  if (keysToDelete.length > 0) {
    console.log(`🧹 Nettoyage automatique: ${keysToDelete.length} entrées expirées supprimées`);
  }
}, 10 * 60 * 1000);

export default {
  optimizedQuery,
  optimizedGetDoc,
  batchQueries,
  batchWrites,
  optimizedListener,
  invalidateCache,
  getCacheStats,
  clearCache,
  useOptimizedQuery
};