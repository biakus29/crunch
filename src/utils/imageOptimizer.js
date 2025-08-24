/**
 * Utilitaires d'optimisation d'images pour améliorer les performances
 */

import React from 'react';

/**
 * Génère une URL optimisée pour une image
 * @param {string} src - URL source de l'image
 * @param {number} width - Largeur souhaitée (optionnel)
 * @param {number} quality - Qualité de l'image (1-100, par défaut 80)
 * @returns {string} URL optimisée
 */
export const getOptimizedImageUrl = (src, width, quality = 80) => {
  // Si l'URL est vide ou null, retourner une image placeholder
  if (!src) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlZWVlZWUiLz48L3N2Zz4=';
  }

  // Si c'est déjà une URL data, la retourner telle quelle
  if (src.startsWith('data:')) {
    return src;
  }

  // Si c'est une URL externe (comme Cloudinary, Imgix, etc.)
  if (src.startsWith('http')) {
    // Ajouter des paramètres d'optimisation si c'est une URL Cloudinary
    if (src.includes('cloudinary.com')) {
      const params = [];
      if (width) params.push(`w_${width}`);
      params.push(`q_${quality}`);
      params.push('f_auto');
      
      // Insérer les paramètres dans l'URL
      return src.replace('/upload/', `/upload/${params.join(',')}/`);
    }
    
    // Pour les autres URLs externes, retourner telle quelle
    return src;
  }

  // Pour les images locales, retourner l'URL telle quelle
  return src;
};

/**
 * Composant Image optimisé avec lazy loading et dimensions
 * @param {Object} props - Propriétés du composant
 * @returns {JSX.Element} Élément image optimisé
 */
export const OptimizedImage = ({
  src,
  alt,
  width,
  height,
  className,
  quality = 80,
  ...props
}) => {
  const optimizedSrc = getOptimizedImageUrl(src, width, quality);
  
  return (
    <img
      src={optimizedSrc}
      alt={alt || ''}
      width={width}
      height={height}
      loading="lazy"
      className={className}
      {...props}
    />
  );
};

/**
 * Précharge les images importantes pour améliorer le LCP (Largest Contentful Paint)
 * @param {Array<string>} imageUrls - Tableau d'URLs d'images à précharger
 */
export const preloadCriticalImages = (imageUrls = []) => {
  if (!imageUrls.length) return;
  
  // Précharger uniquement si le navigateur est inactif
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      imageUrls.forEach(url => {
        const img = new Image();
        img.src = getOptimizedImageUrl(url);
      });
    });
  } else {
    // Fallback pour les navigateurs qui ne supportent pas requestIdleCallback
    setTimeout(() => {
      imageUrls.forEach(url => {
        const img = new Image();
        img.src = getOptimizedImageUrl(url);
      });
    }, 1000);
  }
};

/**
 * Hook pour implémenter le lazy loading d'images
 * @returns {Object} Fonctions et états pour le lazy loading
 */
export const useLazyImages = () => {
  const observer = React.useRef(
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const lazyImage = entry.target;
                lazyImage.src = lazyImage.dataset.src;
                lazyImage.classList.remove('lazy');
                observer.current.unobserve(lazyImage);
              }
            });
          },
          { rootMargin: '200px 0px' }
        )
      : null
  );

  React.useEffect(() => {
    const currentObserver = observer.current;
    
    if (currentObserver) {
      const lazyImages = document.querySelectorAll('img.lazy');
      lazyImages.forEach(img => currentObserver.observe(img));
    }
    
    return () => {
      if (currentObserver) {
        currentObserver.disconnect();
      }
    };
  }, []);

  return {
    LazyImage: ({ src, alt, width, height, className, ...props }) => (
      <img
        className={`lazy ${className || ''}`}
        src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlZWVlZWUiLz48L3N2Zz4="
        data-src={getOptimizedImageUrl(src, width)}
        alt={alt || ''}
        width={width}
        height={height}
        {...props}
      />
    )
  };
};