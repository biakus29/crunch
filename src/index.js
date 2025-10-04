import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { measurePerformance, optimizeImageLoading } from './utils/buildOptimizer';

// Enregistrer le Service Worker pour la mise en cache
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        // Vérifier les mises à jour du Service Worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nouvelle version disponible
                // Optionnel: Notifier l'utilisateur de la mise à jour
                if (window.confirm('Une nouvelle version est disponible. Voulez-vous actualiser ?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ Échec de l\'enregistrement du Service Worker:', error);
      });
  });
}

// Optimiser le chargement des images après le chargement initial
window.addEventListener('load', () => {
  // Délai pour permettre au contenu principal de se charger
  setTimeout(() => {
    optimizeImageLoading();
  }, 1000);
});

// Précharger les ressources critiques
const preloadCriticalResources = () => {
  // Précharger les polices importantes
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
  fontLink.as = 'style';
  fontLink.onload = function() { this.onload = null; this.rel = 'stylesheet'; };
  document.head.appendChild(fontLink);

  // Précharger les images critiques si elles existent
  const criticalImages = [
    '/logo192.png',
    '/favicon.ico'
  ];

  criticalImages.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = src;
    link.as = 'image';
    document.head.appendChild(link);
  });
};

// Exécuter le préchargement
preloadCriticalResources();

// Optimisation du rendu React
const root = ReactDOM.createRoot(document.getElementById('root'));

// Utiliser concurrent features si disponible
if (React.startTransition) {
  React.startTransition(() => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Mesurer les performances Web Vitals
const sendToAnalytics = ({ name, value, id }) => {
  // En production, envoyer les métriques à votre service d'analytics
  if (process.env.NODE_ENV === 'production') {
    // Exemple avec Google Analytics
    if (window.gtag) {
      window.gtag('event', name, {
        event_category: 'Web Vitals',
        event_label: id,
        value: Math.round(name === 'CLS' ? value * 1000 : value),
        non_interaction: true,
      });
    }
    
    // Ou envoyer à votre propre endpoint
    fetch('/api/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value, id }),
    }).catch(console.error);
  } else {
    // En développement, afficher dans la console
  }
};

// Démarrer la mesure des performances
reportWebVitals(sendToAnalytics);

// Mesurer les performances personnalisées
window.addEventListener('load', () => {
  measurePerformance();
});

// Gestion des erreurs globales pour améliorer la stabilité
window.addEventListener('error', (event) => {
  console.error('❌ Erreur JavaScript:', event.error);
  
  // En production, envoyer les erreurs à votre service de monitoring
  if (process.env.NODE_ENV === 'production') {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: event.error?.message || 'Erreur inconnue',
        stack: event.error?.stack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {
      // Ignorer les erreurs de reporting d'erreurs
    });
  }
});

// Gestion des promesses rejetées
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Promesse rejetée:', event.reason);
  
  if (process.env.NODE_ENV === 'production') {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Promesse rejetée: ' + (event.reason?.message || event.reason),
        stack: event.reason?.stack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {
      // Ignorer les erreurs de reporting d'erreurs
    });
  }
});

// Optimisation de la mémoire - nettoyage périodique
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    // Nettoyer le cache Firebase si disponible
    if (window.firebaseCache) {
      window.firebaseCache.cleanup();
    }
    
    // Forcer le garbage collection si disponible (Chrome DevTools)
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
    }
  }, 5 * 60 * 1000); // Toutes les 5 minutes
}