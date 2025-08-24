/**
 * Service Worker pour la mise en cache et l'amélioration des performances
 */

const CACHE_NAME = 'crunch-app-v1.0.0';
const STATIC_CACHE_NAME = 'crunch-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'crunch-dynamic-v1.0.0';

// Ressources à mettre en cache lors de l'installation
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico',
  // Polices importantes
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  // Images critiques
  '/logo192.png',
  '/logo512.png',
];

// URLs à ne pas mettre en cache
const EXCLUDED_URLS = [
  '/api/auth',
  '/api/payment',
  'chrome-extension://',
  'moz-extension://',
];

// Stratégies de cache
const CACHE_STRATEGIES = {
  // Cache First - pour les assets statiques
  CACHE_FIRST: 'cache-first',
  // Network First - pour les données dynamiques
  NETWORK_FIRST: 'network-first',
  // Stale While Revalidate - pour les ressources qui peuvent être mises à jour
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
};

// Configuration des routes et leurs stratégies
const ROUTE_STRATEGIES = [
  {
    pattern: /\.(js|css|woff2?|ttf|eot)$/,
    strategy: CACHE_STRATEGIES.CACHE_FIRST,
    cacheName: STATIC_CACHE_NAME,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
  },
  {
    pattern: /\.(png|jpg|jpeg|gif|svg|webp|avif)$/,
    strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    cacheName: 'images-cache',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  },
  {
    pattern: /^https:\/\/firestore\.googleapis\.com/,
    strategy: CACHE_STRATEGIES.NETWORK_FIRST,
    cacheName: 'firebase-cache',
    maxAge: 5 * 60 * 1000, // 5 minutes
  },
  {
    pattern: /\/api\//,
    strategy: CACHE_STRATEGIES.NETWORK_FIRST,
    cacheName: 'api-cache',
    maxAge: 2 * 60 * 1000, // 2 minutes
  },
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installation en cours...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Mise en cache des ressources statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Installation terminée');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Erreur lors de l\'installation:', error);
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activation en cours...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Supprimer les anciens caches
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName.startsWith('crunch-')) {
              console.log('🗑️ Service Worker: Suppression de l\'ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activation terminée');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Erreur lors de l\'activation:', error);
      })
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les URLs exclues
  if (EXCLUDED_URLS.some(excludedUrl => request.url.includes(excludedUrl))) {
    return;
  }

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Trouver la stratégie appropriée pour cette requête
  const routeStrategy = ROUTE_STRATEGIES.find(route => 
    route.pattern.test(request.url)
  );

  if (routeStrategy) {
    event.respondWith(handleRequest(request, routeStrategy));
  } else {
    // Stratégie par défaut pour les pages HTML
    event.respondWith(handlePageRequest(request));
  }
});

// Gestion des requêtes avec stratégies spécifiques
async function handleRequest(request, strategy) {
  const { cacheName, strategy: strategyType, maxAge } = strategy;

  try {
    switch (strategyType) {
      case CACHE_STRATEGIES.CACHE_FIRST:
        return await cacheFirst(request, cacheName, maxAge);
      
      case CACHE_STRATEGIES.NETWORK_FIRST:
        return await networkFirst(request, cacheName, maxAge);
      
      case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
        return await staleWhileRevalidate(request, cacheName, maxAge);
      
      default:
        return await fetch(request);
    }
  } catch (error) {
    console.error('❌ Service Worker: Erreur lors de la gestion de la requête:', error);
    return await handleOfflineFallback(request);
  }
}

// Stratégie Cache First
async function cacheFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stratégie Network First
async function networkFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stratégie Stale While Revalidate
async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Mise à jour en arrière-plan
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Ignorer les erreurs réseau en arrière-plan
  });

  // Retourner la réponse en cache si disponible, sinon attendre la réponse réseau
  if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
    return cachedResponse;
  }

  return await fetchPromise;
}

// Gestion des requêtes de pages
async function handlePageRequest(request) {
  try {
    // Essayer de récupérer depuis le réseau
    const networkResponse = await fetch(request);
    
    // Mettre en cache les pages HTML
    if (networkResponse.ok && request.headers.get('accept').includes('text/html')) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback vers le cache
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback vers la page d'accueil si disponible
    const fallbackResponse = await cache.match('/');
    if (fallbackResponse) {
      return fallbackResponse;
    }
    
    // Page d'erreur hors ligne
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hors ligne - Crunch</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center; 
              padding: 50px; 
              background: #f5f5f5;
            }
            .offline-container {
              max-width: 400px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .offline-icon { font-size: 64px; margin-bottom: 20px; }
            h1 { color: #333; margin-bottom: 10px; }
            p { color: #666; line-height: 1.5; }
            .retry-btn {
              background: #059669;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              cursor: pointer;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="offline-container">
            <div class="offline-icon">📱</div>
            <h1>Vous êtes hors ligne</h1>
            <p>Vérifiez votre connexion internet et réessayez.</p>
            <button class="retry-btn" onclick="window.location.reload()">
              Réessayer
            </button>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// Fallback hors ligne
async function handleOfflineFallback(request) {
  if (request.headers.get('accept').includes('text/html')) {
    return await handlePageRequest(request);
  }
  
  // Pour les autres types de ressources, retourner une réponse d'erreur
  return new Response('Ressource non disponible hors ligne', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

// Vérifier si une réponse en cache a expiré
function isExpired(response, maxAge) {
  if (!maxAge) return false;
  
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  
  const date = new Date(dateHeader);
  const now = new Date();
  
  return (now.getTime() - date.getTime()) > maxAge;
}

// Nettoyage périodique du cache
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAN_CACHE') {
    cleanupCache();
  }
});

// Fonction de nettoyage du cache
async function cleanupCache() {
  console.log('🧹 Service Worker: Nettoyage du cache en cours...');
  
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      
      // Supprimer les entrées expirées
      if (isExpired(response, 24 * 60 * 60 * 1000)) { // 24 heures
        await cache.delete(request);
      }
    }
  }
  
  console.log('✅ Service Worker: Nettoyage du cache terminé');
}

// Nettoyage automatique toutes les heures
setInterval(cleanupCache, 60 * 60 * 1000);

console.log('🎉 Service Worker: Chargé et prêt!');