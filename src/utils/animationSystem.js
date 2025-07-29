import { motion, AnimatePresence } from 'framer-motion';

// ==================== CONSTANTES D'ANIMATION ====================
export const ANIMATION_VARIANTS = {
  // Animations de base
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3, ease: "easeOut" }
  },

  fadeInUp: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -30 },
    transition: { duration: 0.5, ease: "easeOut" }
  },

  fadeInDown: {
    initial: { opacity: 0, y: -30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 30 },
    transition: { duration: 0.5, ease: "easeOut" }
  },

  slideInLeft: {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
    transition: { duration: 0.4, ease: "easeOut" }
  },

  slideInRight: {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
    transition: { duration: 0.4, ease: "easeOut" }
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { duration: 0.4, ease: "easeOut" }
  },

  // Animations spécialisées pour l'UI
  buttonPress: {
    whileHover: { scale: 1.05, y: -2 },
    whileTap: { scale: 0.95 },
    transition: { duration: 0.2, ease: "easeOut" }
  },

  cardHover: {
    whileHover: { 
      scale: 1.02, 
      y: -8,
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)" 
    },
    transition: { duration: 0.3, ease: "easeOut" }
  },

  // Animations de chargement
  pulse: {
    animate: { 
      scale: [1, 1.1, 1],
      opacity: [1, 0.8, 1]
    },
    transition: { 
      duration: 2, 
      repeat: Infinity,
      ease: "easeInOut" 
    }
  },

  spin: {
    animate: { rotate: 360 },
    transition: { 
      duration: 1, 
      repeat: Infinity,
      ease: "linear" 
    }
  },

  // Animations de notification
  notificationPop: {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: 1, rotate: 0 },
    exit: { scale: 0, rotate: 180 },
    transition: { 
      type: "spring",
      stiffness: 200,
      damping: 15
    }
  },

  // Animations de stagger (cascade)
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },

  staggerItem: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  }
};

// ==================== HOOKS PERSONNALISÉS ====================
export const useAnimation = () => {
  // Hook pour gérer les animations conditionnelles selon la performance
  const getAnimationConfig = (isLowPerformance = false) => ({
    duration: isLowPerformance ? 0.2 : 0.4,
    ease: isLowPerformance ? "linear" : "easeOut"
  });

  // Hook pour détecter les préférences de réduction de mouvement
  const prefersReducedMotion = () => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  };

  // Hook pour les animations de scroll
  const useScrollAnimation = (threshold = 0.1, rootMargin = "50px") => ({
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, threshold, rootMargin },
    transition: { duration: 0.6, ease: "easeOut" }
  });

  return {
    getAnimationConfig,
    prefersReducedMotion,
    useScrollAnimation
  };
};

// ==================== COMPOSANTS ANIMÉS RÉUTILISABLES ====================
export const AnimatedComponents = {
  // Composant de page avec transition
  AnimatedPage: ({ children, className = "" }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      {children}
    </motion.div>
  ),

  // Bouton animé
  AnimatedButton: ({ 
    children, 
    onClick, 
    variant = "primary", 
    size = "medium",
    className = "",
    disabled = false 
  }) => {
    const baseClasses = "font-semibold rounded-full transition-colors";
    const sizeClasses = {
      small: "px-4 py-2 text-sm",
      medium: "px-6 py-3",
      large: "px-8 py-4 text-lg"
    };
    const variantClasses = {
      primary: "bg-green-600 text-white hover:bg-green-700",
      secondary: "border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white",
      outline: "border-2 border-gray-300 text-gray-700 hover:border-green-600 hover:text-green-600"
    };

    return (
      <motion.button
        onClick={onClick}
        disabled={disabled}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...ANIMATION_VARIANTS.buttonPress}
        whileDisabled={{ opacity: 0.5, scale: 1 }}
      >
        {children}
      </motion.button>
    );
  },

  // Card animée
  AnimatedCard: ({ 
    children, 
    onClick, 
    className = "",
    hoverEffect = true 
  }) => (
    <motion.div
      className={`bg-white rounded-2xl shadow-sm overflow-hidden ${className}`}
      onClick={onClick}
      {...(hoverEffect ? ANIMATION_VARIANTS.cardHover : {})}
      cursor={onClick ? "pointer" : "default"}
    >
      {children}
    </motion.div>
  ),

  // Image animée
  AnimatedImage: ({ 
    src, 
    alt, 
    className = "",
    hoverZoom = true 
  }) => (
    <motion.div className="relative overflow-hidden">
      <motion.img
        src={src}
        alt={alt}
        className={className}
        whileHover={hoverZoom ? { scale: 1.1 } : {}}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </motion.div>
  ),

  // Loader animé
  AnimatedLoader: ({ 
    type = "spinner", 
    size = "medium",
    color = "green" 
  }) => {
    const sizeClasses = {
      small: "w-4 h-4",
      medium: "w-8 h-8",
      large: "w-12 h-12"
    };

    const colorClasses = {
      green: "border-green-200 border-t-green-600",
      blue: "border-blue-200 border-t-blue-600",
      gray: "border-gray-200 border-t-gray-600"
    };

    const loaders = {
      spinner: (
        <motion.div
          className={`${sizeClasses[size]} border-4 ${colorClasses[color]} rounded-full`}
          {...ANIMATION_VARIANTS.spin}
        />
      ),
      pulse: (
        <motion.div
          className={`${sizeClasses[size]} bg-${color}-600 rounded-full`}
          {...ANIMATION_VARIANTS.pulse}
        />
      ),
      dots: (
        <div className="flex space-x-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`w-2 h-2 bg-${color}-600 rounded-full`}
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                delay: i * 0.2 
              }}
            />
          ))}
        </div>
      )
    };

    return loaders[type];
  },

  // Notification animée
  AnimatedNotification: ({ 
    children, 
    isVisible, 
    onClose,
    type = "info" 
  }) => {
    const typeClasses = {
      success: "bg-green-50 border-green-200 text-green-800",
      error: "bg-red-50 border-red-200 text-red-800",
      warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
      info: "bg-blue-50 border-blue-200 text-blue-800"
    };

    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`fixed top-4 right-4 p-4 rounded-lg border ${typeClasses[type]} shadow-lg z-50`}
            {...ANIMATION_VARIANTS.notificationPop}
          >
            {children}
            {onClose && (
              <motion.button
                onClick={onClose}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                ×
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  },

  // Liste avec animation stagger
  AnimatedList: ({ 
    items, 
    renderItem, 
    className = "",
    staggerDelay = 0.1 
  }) => (
    <motion.div
      className={className}
      variants={ANIMATION_VARIANTS.staggerContainer}
      initial="initial"
      animate="animate"
    >
      {items.map((item, index) => (
        <motion.div
          key={item.id || index}
          variants={{
            ...ANIMATION_VARIANTS.staggerItem,
            transition: { 
              ...ANIMATION_VARIANTS.staggerItem.transition,
              delay: index * staggerDelay 
            }
          }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
    </motion.div>
  ),

  // Modal animé
  AnimatedModal: ({ 
    isOpen, 
    onClose, 
    children, 
    className = "" 
  }) => (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            className={`bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden ${className}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
};

// ==================== ANIMATIONS SPÉCIALISÉES POUR L'ALIMENTATION ====================
export const FoodAnimations = {
  // Animation de cuisson
  cooking: {
    animate: {
      rotate: [0, 360],
      scale: [1, 1.1, 1]
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },

  // Animation de service
  serving: {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: 1, rotate: 0 },
    transition: { 
      type: "spring",
      stiffness: 200,
      damping: 15
    }
  },

  // Animation de livraison
  delivery: {
    animate: {
      x: [0, 10, 0],
      y: [0, -5, 0]
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },

  // Animation de "heart" pour les favoris
  heartBeat: {
    whileHover: { scale: 1.2 },
    whileTap: { scale: 0.8 },
    animate: { scale: [1, 1.3, 1] },
    transition: { duration: 0.3 }
  }
};

// ==================== ANIMATIONS SPÉCIALISÉES POUR LES CARDS ====================
export const CardAnimations = {
  // Animation d'entrée pour les cards de produits
  productCardEnter: {
    initial: { opacity: 0, y: 50, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.95 },
    transition: { 
      duration: 0.5, 
      ease: "easeOut",
      type: "spring",
      stiffness: 100
    }
  },

  // Animation de survol pour les cards de produits
  productCardHover: {
    whileHover: { 
      scale: 1.03, 
      y: -8,
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
      rotateY: 2
    },
    whileTap: { 
      scale: 0.98,
      y: -4
    },
    transition: { 
      duration: 0.3, 
      ease: "easeOut" 
    }
  },

  // Animation pour les images de produits
  productImageHover: {
    whileHover: { 
      scale: 1.15,
      filter: "brightness(1.1)"
    },
    transition: { 
      duration: 0.4, 
      ease: "easeOut" 
    }
  },

  // Animation pour les badges de promotion
  promotionBadge: {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: 1, rotate: 0 },
    whileHover: { scale: 1.1, rotate: 5 },
    transition: { 
      type: "spring",
      stiffness: 200,
      damping: 15
    }
  },

  // Animation pour les boutons d'ajout au panier
  addToCartButton: {
    whileHover: { 
      scale: 1.15,
      backgroundColor: "#059669",
      boxShadow: "0 8px 25px rgba(16, 185, 129, 0.4)"
    },
    whileTap: { 
      scale: 0.9,
      backgroundColor: "#047857"
    },
    transition: { 
      duration: 0.2, 
      ease: "easeOut" 
    }
  },

  // Animation pour les prix
  priceAnimation: {
    whileHover: { 
      scale: 1.05,
      color: "#059669"
    },
    transition: { 
      duration: 0.2 
    }
  },

  // Animation pour les catégories
  categoryCardHover: {
    whileHover: { 
      scale: 1.08, 
      y: -5,
      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
      backgroundColor: "#f0fdf4"
    },
    whileTap: { 
      scale: 0.95 
    },
    transition: { 
      duration: 0.3, 
      ease: "easeOut" 
    }
  },

  // Animation pour les menus
  menuCardHover: {
    whileHover: { 
      scale: 1.02, 
      y: -3,
      boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)"
    },
    whileTap: { 
      scale: 0.98 
    },
    transition: { 
      duration: 0.25, 
      ease: "easeOut" 
    }
  },

  // Animation de chargement pour les cards
  cardLoading: {
    animate: {
      opacity: [0.5, 1, 0.5],
      scale: [0.98, 1, 0.98]
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },

  // Animation de stagger pour les grilles de cards
  cardGridStagger: {
    container: {
      animate: {
        transition: {
          staggerChildren: 0.1,
          delayChildren: 0.2
        }
      }
    },
    item: {
      initial: { opacity: 0, y: 30, scale: 0.9 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { 
        duration: 0.5, 
        ease: "easeOut",
        type: "spring",
        stiffness: 100
      }
    }
  },

  // Animation pour les cards avec effet de "floating"
  floatingCard: {
    animate: {
      y: [0, -5, 0],
      boxShadow: [
        "0 5px 15px rgba(0, 0, 0, 0.1)",
        "0 15px 35px rgba(0, 0, 0, 0.15)",
        "0 5px 15px rgba(0, 0, 0, 0.1)"
      ]
    },
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },

  // Animation pour les cards avec effet de "pulse" au survol
  pulseCard: {
    whileHover: {
      scale: 1.05,
      boxShadow: "0 0 0 8px rgba(16, 185, 129, 0.1)",
      transition: {
        boxShadow: {
          duration: 0.3,
          ease: "easeOut"
        }
      }
    },
    transition: { 
      duration: 0.3, 
      ease: "easeOut" 
    }
  }
};

// ==================== UTILITAIRES D'ANIMATION ====================
export const AnimationUtils = {
  // Créer une animation personnalisée
  createAnimation: (config) => ({
    ...ANIMATION_VARIANTS.fadeIn,
    ...config
  }),

  // Combiner plusieurs animations
  combineAnimations: (...animations) => {
    const combined = {};
    animations.forEach(animation => {
      Object.assign(combined, animation);
    });
    return combined;
  },

  // Créer une animation de scroll avec options
  createScrollAnimation: (options = {}) => ({
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { 
      once: true, 
      threshold: options.threshold || 0.1,
      rootMargin: options.rootMargin || "50px"
    },
    transition: { 
      duration: options.duration || 0.6, 
      ease: "easeOut",
      delay: options.delay || 0
    }
  }),

  // Animation de page avec transition
  pageTransition: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3, ease: "easeInOut" }
  }
};

// ==================== HOOKS SPÉCIALISÉS ====================
export const useFoodAnimations = () => {
  const { prefersReducedMotion } = useAnimation();

  const getFoodAnimation = (type) => {
    if (prefersReducedMotion()) {
      return { animate: { opacity: 1 } };
    }
    return FoodAnimations[type] || ANIMATION_VARIANTS.fadeIn;
  };

  return { getFoodAnimation };
};

export const useScrollTrigger = (threshold = 0.1) => {
  const scrollAnimation = AnimationUtils.createScrollAnimation({ threshold });
  
  return {
    ...scrollAnimation,
    whileInView: { ...scrollAnimation.whileInView },
    viewport: { ...scrollAnimation.viewport }
  };
};

// Export par défaut pour faciliter l'import
export default {
  ANIMATION_VARIANTS,
  AnimatedComponents,
  FoodAnimations,
  AnimationUtils,
  useAnimation,
  useFoodAnimations,
  useScrollTrigger
}; 