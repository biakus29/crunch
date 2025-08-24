/**
 * Utilitaires d'optimisation des performances pour l'application React
 */
import React, { lazy, Suspense } from 'react';

/**
 * Fonction pour charger un composant de manière paresseuse (lazy loading)
 * @param {Function} importFunc - Fonction d'importation dynamique
 * @param {JSX.Element} fallback - Composant à afficher pendant le chargement
 * @returns {React.LazyExoticComponent} Composant chargé paresseusement
 */
export const lazyLoadComponent = (importFunc, fallback = null) => {
  const LazyComponent = lazy(importFunc);
  
  return (props) => (
    <Suspense fallback={fallback || <DefaultLoadingFallback />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

/**
 * Composant de chargement par défaut
 */
export const DefaultLoadingFallback = () => (
  <div className="flex items-center justify-center p-4 w-full h-full min-h-[200px]">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
  </div>
);

/**
 * Memoize un composant pour éviter les re-rendus inutiles
 * @param {React.Component} Component - Composant à mémoriser
 * @param {Function} propsAreEqual - Fonction de comparaison des props (optionnelle)
 * @returns {React.MemoExoticComponent} Composant mémorisé
 */
export const memoizeComponent = (Component, propsAreEqual = null) => {
  return React.memo(Component, propsAreEqual);
};

/**
 * Optimise les listes avec virtualization pour améliorer les performances
 * @param {Array} items - Éléments de la liste
 * @param {Function} renderItem - Fonction de rendu pour chaque élément
 * @param {Object} options - Options de configuration
 * @returns {JSX.Element} Liste virtualisée
 */
export const VirtualizedList = ({ 
  items, 
  renderItem, 
  itemHeight = 50,
  windowSize = 10,
  className = ""
}) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - windowSize);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + (containerRef.current?.clientHeight || 0)) / itemHeight) + windowSize);

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div 
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => (
          <div 
            key={startIndex + index}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              height: itemHeight,
              width: '100%'
            }}
          >
            {renderItem(item, startIndex + index)}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Optimise le rendu conditionnel pour éviter les re-rendus inutiles
 * @param {boolean} condition - Condition d'affichage
 * @param {JSX.Element} children - Contenu à afficher si la condition est vraie
 * @returns {JSX.Element|null} Contenu ou null
 */
export const OptimizedConditional = ({ condition, children }) => {
  // Utilise useMemo pour éviter de recréer l'élément à chaque rendu
  return React.useMemo(() => {
    return condition ? children : null;
  }, [condition, children]);
};

/**
 * Optimise les animations en détectant les préférences de réduction de mouvement
 * @returns {boolean} True si l'utilisateur préfère réduire les animations
 */
export const usePrefersReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handleChange = () => setPrefersReduced(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReduced;
};

/**
 * Optimise le chargement des données avec mise en cache
 * @param {Function} fetchFunction - Fonction pour récupérer les données
 * @param {string} cacheKey - Clé pour stocker les données en cache
 * @param {number} cacheDuration - Durée de validité du cache en millisecondes
 * @returns {Object} Données et état de chargement
 */
export const useCachedData = (fetchFunction, cacheKey, cacheDuration = 5 * 60 * 1000) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Vérifier si les données sont en cache et valides
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const { data: cachedValue, timestamp } = JSON.parse(cachedData);
          const isValid = Date.now() - timestamp < cacheDuration;
          
          if (isValid) {
            setData(cachedValue);
            setLoading(false);
            return;
          }
        }

        // Si pas de cache valide, récupérer les données
        const result = await fetchFunction();
        setData(result);
        
        // Mettre en cache les données
        localStorage.setItem(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }));
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [fetchFunction, cacheKey, cacheDuration]);

  return { data, loading, error };
};