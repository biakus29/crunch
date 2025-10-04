/**
 * Configuration d'optimisation du build pour améliorer les performances
 */

// Configuration pour l'optimisation du bundle
export const bundleOptimization = {
  // Configuration de code splitting
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      // Séparer les dépendances vendor
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
        priority: 10,
      },
      // Séparer les composants communs
      common: {
        name: 'common',
        minChunks: 2,
        chunks: 'all',
        priority: 5,
        reuseExistingChunk: true,
      },
      // Séparer Firebase
      firebase: {
        test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
        name: 'firebase',
        chunks: 'all',
        priority: 15,
      },
      // Séparer Framer Motion
      animations: {
        test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
        name: 'animations',
        chunks: 'all',
        priority: 12,
      },
    },
  },
};

// Configuration pour la compression
export const compressionConfig = {
  // Activer la compression gzip
  gzip: true,
  // Activer la compression brotli si disponible
  brotli: true,
  // Seuil minimum pour la compression (en bytes)
  threshold: 1024,
  // Ratio de compression minimum
  minRatio: 0.8,
};

// Configuration pour l'optimisation des images
export const imageOptimizationConfig = {
  // Formats d'images supportés
  formats: ['webp', 'avif', 'jpeg', 'png'],
  // Qualité par défaut
  quality: 80,
  // Tailles responsives
  sizes: [320, 640, 768, 1024, 1280, 1920],
  // Lazy loading par défaut
  lazyLoading: true,
};

// Configuration pour le préchargement des ressources
export const preloadConfig = {
  // Ressources critiques à précharger
  critical: [
    // Polices importantes
    '/fonts/primary-font.woff2',
    // Images critiques (logo, hero images)
    '/images/logo.png',
    // CSS critique
    '/css/critical.css',
  ],
  // Ressources à précharger avec priorité faible
  prefetch: [
    // Pages fréquemment visitées
    '/accueil',
    '/menu',
    '/panier',
  ],
};

// Configuration pour la mise en cache
export const cacheConfig = {
  // Stratégies de cache par type de ressource
  strategies: {
    // Cache des assets statiques (images, fonts, etc.)
    static: {
      strategy: 'CacheFirst',
      maxAge: 30 * 24 * 60 * 60, // 30 jours
      maxEntries: 100,
    },
    // Cache des pages
    pages: {
      strategy: 'NetworkFirst',
      maxAge: 24 * 60 * 60, // 1 jour
      maxEntries: 50,
    },
    // Cache des API calls
    api: {
      strategy: 'NetworkFirst',
      maxAge: 5 * 60, // 5 minutes
      maxEntries: 100,
    },
    // Cache des données Firebase
    firebase: {
      strategy: 'StaleWhileRevalidate',
      maxAge: 10 * 60, // 10 minutes
      maxEntries: 200,
    },
  },
};

// Configuration pour l'optimisation du CSS
export const cssOptimization = {
  // Purger le CSS inutilisé
  purgeCSS: {
    enabled: true,
    content: [
      './src/**/*.{js,jsx,ts,tsx}',
      './public/index.html',
    ],
    // Classes à toujours conserver
    safelist: [
      /^animate-/,
      /^transition-/,
      /^duration-/,
      /^ease-/,
      'toast-container',
      'toast-success',
      'toast-error',
    ],
  },
  // Minification CSS
  minify: true,
  // Optimisation des propriétés CSS
  autoprefixer: true,
};

// Configuration pour l'optimisation du JavaScript
export const jsOptimization = {
  // Minification
  minify: true,
  // Suppression des console.log en production
  removeConsole: true,
  // Suppression des commentaires
  removeComments: true,
  // Tree shaking
  treeShaking: true,
  // Optimisation des imports
  optimizeImports: true,
};

// Configuration pour les Web Vitals
export const webVitalsConfig = {
  // Seuils pour les métriques de performance
  thresholds: {
    // Largest Contentful Paint
    LCP: 2500, // ms
    // First Input Delay
    FID: 100, // ms
    // Cumulative Layout Shift
    CLS: 0.1,
    // First Contentful Paint
    FCP: 1800, // ms
    // Time to Interactive
    TTI: 3800, // ms
  },
  // Reporting des métriques
  reporting: {
    enabled: true,
    endpoint: '/api/web-vitals',
  },
};

// Fonction pour appliquer les optimisations de build
export const applyBuildOptimizations = () => {
  // Vérifier si nous sommes en mode production
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    return;
  }
  // Appliquer les optimisations
  const optimizations = {
    bundle: bundleOptimization,
    compression: compressionConfig,
    images: imageOptimizationConfig,
    preload: preloadConfig,
    cache: cacheConfig,
    css: cssOptimization,
    js: jsOptimization,
    webVitals: webVitalsConfig,
  };

  return optimizations;
};

// Fonction pour mesurer les performances
export const measurePerformance = () => {
  if (typeof window === 'undefined') return;

  // Mesurer les Web Vitals
  const measureWebVitals = async () => {
    try {
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');
      
      getCLS(console.log);
      getFID(console.log);
      getFCP(console.log);
      getLCP(console.log);
      getTTFB(console.log);
    } catch (error) {
      console.warn('Web Vitals non disponibles:', error);
    }
  };

  // Mesurer les performances de navigation
  const measureNavigation = () => {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
      }
    }
  };

  // Exécuter les mesures
  measureWebVitals();
  measureNavigation();
};

// Fonction pour optimiser les images au runtime
export const optimizeImageLoading = () => {
  // Implémenter l'intersection observer pour le lazy loading
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            observer.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px',
    });

    // Observer toutes les images lazy
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
};

// Export par défaut
export default {
  applyBuildOptimizations,
  measurePerformance,
  optimizeImageLoading,
  bundleOptimization,
  compressionConfig,
  imageOptimizationConfig,
  preloadConfig,
  cacheConfig,
  cssOptimization,
  jsOptimization,
  webVitalsConfig,
};