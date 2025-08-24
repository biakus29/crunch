import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useCart } from '../context/cartcontext';
// AddToCartModal will be lazy-loaded below
import { onAuthStateChanged } from 'firebase/auth';
import { motion } from 'framer-motion';
import { 
  ANIMATION_VARIANTS, 
  AnimatedComponents, 
  FoodAnimations, 
  CardAnimations,
  useScrollTrigger 
} from '../utils/animationSystem';
// LoyaltyHero and PromotionsHero will be lazy-loaded below
import { 
  ShoppingCart, 
  User, 
  Home, 
  Package, 
  Check
} from 'lucide-react';
import { HeaderBar, CategoriesGrid, NotificationsModal, MenusList, ProductsGrid } from '../components/home';
import useMenuFilters from '../hooks/useMenuFilters';
import useMenus from '../hooks/useMenus';
import useUserNotifications from '../hooks/useUserNotifications';
import useFCM from '../hooks/useFCM';
import useUserProfile from '../hooks/useUserProfile';
import { STATUS_LABELS, STATUS_COLORS } from '../shared/constants/orders';
import { trackViewContent, trackPageView } from '../shared/analytics/facebook';
import { formatOrderId } from '../shared/utils/orders';
import { promoSliderSettings, itemSliderSettings } from '../shared/constants/ui';

// Lazy-loaded heavy components
import { lazy, Suspense } from 'react';
const AddToCartModal = lazy(() => import('../components/AddToCartModal'));
const LoyaltyHero = lazy(() => import('../components/LoyaltyHero'));
const PromotionsHero = lazy(() => import('../components/PromotionsHero'));

// Constantes des statuts importées

// ==================== Loaders Personnalisés avec Système Modulaire ====================
const FoodLoader = () => (
  <motion.div 
    {...ANIMATION_VARIANTS.fadeIn}
    className="flex flex-col items-center justify-center h-40"
  >
    <div className="relative">
      <AnimatedComponents.AnimatedLoader type="spinner" size="large" color="green" />
      <motion.span 
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="absolute inset-0 flex items-center justify-center text-3xl"
      >
        🍲
      </motion.span>
    </div>
    <motion.p 
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="mt-4 text-green-600 font-semibold"
    >
      On prépare votre gourmandise…
    </motion.p>
  </motion.div>
);

const DeliveryLoader = () => (
  <motion.div 
    {...ANIMATION_VARIANTS.fadeIn}
    className="flex flex-col items-center justify-center h-40"
  >
    <div className="relative">
      <motion.div 
        {...FoodAnimations.delivery}
        className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center"
      >
        <span className="text-3xl">🛵</span>
      </motion.div>
      <motion.div 
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-2 bg-blue-300 rounded-full blur-sm"
      ></motion.div>
    </div>
    <motion.p 
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="mt-4 text-blue-600 font-semibold"
    >
      Votre commande file vers vous !
    </motion.p>
  </motion.div>
);

const PulseLoader = () => (
  <motion.div 
    {...ANIMATION_VARIANTS.fadeIn}
    className="flex flex-col items-center justify-center h-40"
  >
    <motion.div 
      {...ANIMATION_VARIANTS.pulse}
      className="w-16 h-16 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center"
    >
      <motion.div 
        {...ANIMATION_VARIANTS.spin}
        className="w-8 h-8 border-2 border-white border-t-transparent rounded-full"
      ></motion.div>
    </motion.div>
    <motion.p 
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="mt-4 text-green-600 font-semibold"
    >
      Chargement en cours...
    </motion.p>
  </motion.div>
);

// ==================== Composant Loader Amélioré ====================
const Loader = ({ type = "pulse" }) => {
  switch (type) {
    case "food":
      return <FoodLoader />;
    case "delivery":
      return <DeliveryLoader />;
    default:
      return <PulseLoader />;
  }
};

const HomePage = () => {
  // Hooks d'animation
  const scrollAnimation = useScrollTrigger(0.1);
  const navigate = useNavigate();

  const { categories, items, promos, extraLists, menus, loading, error: dataError, reload } = useMenus();
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [user, setUser] = useState(null);
  // Points utilisateur depuis hook de profil
  const { points: userPoints } = useUserProfile(user?.uid);
  // Recherche avec debounce via hook dédié
  const { query, setQuery, filtered } = useMenuFilters(items, { initialQuery: '', delay: 250 });
  const { cartItems } = useCart();

  // Notifications utilisateur via hook dédié
  const { notifications, markAsRead, markAllAsRead, clearAll } = useUserNotifications(user?.uid);

  // FCM token via hook dédié
  useFCM(user?.uid);

  // Indexation des extraLists supprimée (non utilisée)


  // Vérification de l'utilisateur
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) trackPageView();
    }, () => {
      setError('Erreur lors de la vérification de l\'utilisateur');
    });
    return () => unsubscribeAuth();
  }, []);

  // Points chargés par useUserProfile

  // Promotions appliquées côté useMenus

  // Commandes gérées par un hook dédié (non affichées ici)

  // Ouverture auto du modal s'il y a des non lus
  useEffect(() => {
    if (notifications && notifications.some(n => !n.read) && !showNotificationModal) {
      setShowNotificationModal(true);
    }
  }, [notifications, showNotificationModal]);

  // FCM géré par useFCM

  // Promotions déjà appliquées via useMenus

  // Filtrage géré par useMenuFilters

  // Abonnements commandes gérés par un hook dédié

  // Paramètres des sliders importés

  // Gestion des événements Facebook Pixel
  const handleViewContent = (item) => {
    const price = item.priceType === 'sizes' && item.sizes 
      ? convertPrice(Object.values(item.sizes)[0]) 
      : convertPrice(item.price);
    trackViewContent({ id: item.id, name: item.name, price, currency: 'XAF' });
  };

  // Sélection d'un article
  const handleAddClick = (item, e) => {
    e.preventDefault();
    console.log(`Ajout de ${item.id}, extraLists:`, item.extraLists);
    setSelectedItem({
      ...item,
      extraLists: item.extraLists || [],
    });
  };


  // Fonctions utilitaires
  const getCurrentDay = () => ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][new Date().getDay()];

  const convertPrice = (price) => {
    if (!price || price === undefined || price === null) return 0;
    try {
      if (typeof price === 'string') {
        return parseFloat(price.replace(/\./g, '')) || 0;
      }
      return Number(price) || 0;
    } catch (err) {
      console.warn('Erreur dans convertPrice:', price, err);
      return 0;
    }
  };

  // Gestion du succès d'ajout au panier
  const handleAddToCartSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };


  // Filtrage des articles par jour
  const memoizedFilteredItems = useMemo(() => {
    return filtered.filter(item => item.scheduledDay?.includes(getCurrentDay()));
  }, [filtered]);

  // Gestion du chargement initial
  if (loading.categories || loading.items || loading.promos || loading.menus) {
    return <div className="flex justify-center items-center h-screen"><Loader /></div>;
  }

  // Gestion des erreurs
  if (error || dataError) {
    return (
      <div className="p-4 text-center bg-red-100 text-red-600 transition-opacity duration-500">
        {error || dataError} - <button onClick={() => reload()} className="text-red-600 underline">Réessayer</button>
      </div>
    );
  }

  return (
    <AnimatedComponents.AnimatedPage className="min-h-screen bg-gray-100 pb-20">
      {/* Message de succès animé avec système modulaire */}
      <AnimatedComponents.AnimatedNotification
        isVisible={!!successMessage}
        type="success"
        onClose={() => setSuccessMessage('')}
      >
        <div className="flex items-center">
          <Check className="w-5 h-5 mr-2" />
          {successMessage}
        </div>
      </AnimatedComponents.AnimatedNotification>

      {/* Modal pour l'ajout au panier avec compléments */}
      <Suspense fallback={null}>
        <AddToCartModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
          extraLists={extraLists}
          onSuccess={handleAddToCartSuccess}
        />
      </Suspense>

      {/* En-tête modularisée */}
      <HeaderBar
        notifications={notifications}
        searchQuery={query}
        onSearchChange={(e) => setQuery(e.target.value)}
        onOpenNotifications={() => setShowNotificationModal(true)}
      />

        {/* Section Conditionnelle : Fidélité ou Promotions */}
        {userPoints === 0 ? (
          <Suspense fallback={<Loader />}>
            <LoyaltyHero />
          </Suspense>
        ) : (
          <Suspense fallback={<Loader />}>
            <PromotionsHero />
          </Suspense>
        )}

        <NotificationsModal
        isOpen={showNotificationModal}
        notifications={notifications}
        onClose={() => setShowNotificationModal(false)}
        onMarkAllRead={markAllAsRead}
        onClearAll={async () => {
          if (window.confirm('Voulez-vous vraiment supprimer toutes vos notifications ?')) {
            await clearAll();
          }
        }}
        onItemClick={(notification) => {
          if (!notification.read) markAsRead(notification.id);
          setShowNotificationModal(false);
          navigate(`/complete_order/${notification.orderId}`);
        }}
        formatOrderId={formatOrderId}
        STATUS_LABELS={STATUS_LABELS}
        STATUS_COLORS={STATUS_COLORS}
      />

      {/* Catégories modularisées */}
      <CategoriesGrid
        categories={categories}
        loading={loading.categories}
        scrollAnimation={scrollAnimation}
        CardAnimations={CardAnimations}
      />

      {/* Menus modularisés */}
      <MenusList
        menus={menus}
        loading={loading.menus}
        scrollAnimation={scrollAnimation}
        ANIMATION_VARIANTS={ANIMATION_VARIANTS}
        CardAnimations={CardAnimations}
        convertPrice={convertPrice}
      />

      {/* Sélection du jour modularisée */}
      <ProductsGrid
        title="Sélection du jour"
        viewMoreHref="/picks_today"
        items={memoizedFilteredItems}
        loading={loading.items}
        scrollAnimation={scrollAnimation}
        ANIMATION_VARIANTS={ANIMATION_VARIANTS}
        CardAnimations={CardAnimations}
        itemSliderSettings={itemSliderSettings}
        convertPrice={convertPrice}
        onViewContent={handleViewContent}
        onAddClick={handleAddClick}
      />

      {/* Pied de page avec animations */}
      <motion.footer 
        {...ANIMATION_VARIANTS.fadeInUp}
        className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg"
      >
        <div className="grid grid-cols-4">
          <Link to="/accueil" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <Home className="w-5 h-5 mx-auto" /><span className="block text-xs mt-1">Accueil</span>
          </Link>
          <Link to="/cart" className="relative text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <ShoppingCart className="w-5 h-5 mx-auto" />
            {cartItems.length > 0 && (
              <motion.span 
                {...ANIMATION_VARIANTS.scaleIn}
                className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-green-600 rounded-full animate-pulse"
              >
                {cartItems.length}
              </motion.span>
            )}
            <span className="block text-xs mt-1">Panier</span>
          </Link>
          <Link to="/complete_order" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <Package className="w-5 h-5 mx-auto" /><span className="block text-xs mt-1">Commandes</span>
          </Link>
          <Link to="/profile" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <User className="w-5 h-5 mx-auto" /><span className="block text-xs mt-1">Compte</span>
          </Link>
        </div>
      </motion.footer>
    </AnimatedComponents.AnimatedPage>
  );
};

export default HomePage;