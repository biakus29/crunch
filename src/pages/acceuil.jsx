import React, { useEffect, useState, useMemo } from 'react';
import Slider from 'react-slick';
import { Link } from 'react-router-dom';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { collection, getDocs, onSnapshot, doc, updateDoc, query, where, deleteDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useCart } from '../context/cartcontext';
import { onAuthStateChanged } from 'firebase/auth';
import { getMessaging, getToken } from 'firebase/messaging';
import logo from '../image/logo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ANIMATION_VARIANTS, 
  AnimatedComponents, 
  FoodAnimations, 
  CardAnimations,
  AnimationUtils,
  useAnimation,
  useFoodAnimations,
  useScrollTrigger 
} from '../utils/animationSystem';
import LoyaltyHero from '../components/LoyaltyHero';
import PromotionsHero from '../components/PromotionsHero';
import PointsBadge from '../components/PointsBadge';
import { 
  Search, 
  ShoppingCart, 
  User, 
  Home, 
  Package, 
  Bell, 
  X, 
  Plus, 
  Minus, 
  Star, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  Heart, 
  Filter, 
  Grid, 
  List, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  AlertCircle, 
  Info
} from 'lucide-react';

// Constantes pour les statuts des commandes
const STATUS_LABELS = {
  en_attente: 'En attente',
  en_preparation: 'En préparation',
  pret_a_livrer: 'Prêt à livrer',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  echec: 'Échec',
};

const STATUS_COLORS = {
  en_attente: 'text-yellow-600',
  en_preparation: 'text-blue-600',
  pret_a_livrer: 'text-purple-600',
  en_livraison: 'text-orange-600',
  livree: 'text-green-600',
  echec: 'text-red-600',
};

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
  const { prefersReducedMotion } = useAnimation();
  const { getFoodAnimation } = useFoodAnimations();
  const scrollAnimation = useScrollTrigger(0.1);

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [promos, setPromos] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState({
    global: true,
    categories: true,
    items: true,
    promos: true,
    menus: true,
  });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [user, setUser] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const { addToCart, cartItems } = useCart();

  // Indexation des extraLists pour des recherches rapides
  const extraListsById = useMemo(
    () => extraLists.reduce((acc, list) => ({ ...acc, [list.id]: list }), {}),
    [extraLists]
  );

  // Initialisation des tailles par défaut
  useEffect(() => {
    if (items.length > 0) {
      const initialSizes = {};
      items.forEach(item => {
        if (item.priceType === 'sizes' && item.sizes && Object.keys(item.sizes).length > 0) {
          initialSizes[item.id] = Object.keys(item.sizes)[0];
        }
      });
      setSelectedSizes(prev => ({ ...prev, ...initialSizes }));
    }
  }, [items]);

  // Vérification de l'utilisateur
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(prev => ({ ...prev, global: false }));
      if (currentUser && window.fbq) {
        window.fbq('track', 'PageView');
      }
      // Récupérer les points si l'utilisateur est connecté
      if (currentUser) {
        fetchUserPoints(currentUser.uid);
      }
    }, () => {
      setError('Erreur lors de la vérification de l\'utilisateur');
      setLoading(prev => ({ ...prev, global: false }));
    });
    return () => unsubscribeAuth();
  }, []);

  // Récupération des points utilisateur
  const fetchUserPoints = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'usersrestau', userId));
      if (userDoc.exists()) {
        const points = userDoc.data().points || 0;
        setUserPoints(points);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des points:', error);
    }
  };

  // Récupération des données publiques
  const fetchPublicData = async () => {
    try {
      const [categoriesSnap, itemsSnap, promosSnap, extraListsSnap, menusSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'items')),
        getDocs(collection(db, 'promos')),
        getDocs(collection(db, 'extraLists')),
        getDocs(collection(db, 'menus')),
      ]);

      const fetchedItems = itemsSnap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          extraLists: doc.data().extraLists || [],
        }))
        .filter(item => {
          if (item.priceType === 'sizes') {
            const isValid = item.sizes && Object.keys(item.sizes).length > 0;
            if (!isValid) {
              console.warn(`Article ${item.id} ignoré : sizes invalide`, item.sizes);
            }
            return isValid;
          }
          return true;
        });

      const fetchedMenus = menusSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Menu sans nom',
        covers: doc.data().covers || [],
        description: doc.data().description || 'Un menu délicieux à découvrir.',
        price: doc.data().price || null,
        restaurantId: doc.data().restaurantId || null,
      }));

      setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setItems(fetchedItems);
      setFilteredItems(fetchedItems);
      setPromos(promosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setExtraLists(extraListsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setMenus(fetchedMenus);

      setLoading(prev => ({
        ...prev,
        categories: false,
        items: false,
        promos: false,
        menus: false,
      }));
    } catch (err) {
      console.error('Erreur de chargement des données:', err);
      setError('Erreur de chargement des données');
      setLoading(prev => ({
        ...prev,
        categories: false,
        items: false,
        promos: false,
        menus: false,
      }));
    }
  };

  // Récupération des données privées (commandes)
  const fetchPrivateData = async (userId) => {
    try {
      const ordersSnap = await getDocs(query(collection(db, 'orders'), where('userId', '==', userId)));
      setOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setError('Erreur de chargement des commandes');
    }
  };

  // Gestion des notifications
  const markNotificationAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
      setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, read: true } : n)));
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la notification:', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(unreadNotifications.map(n => markNotificationAsRead(n.id)));
    } catch (err) {
      console.error('Erreur lors de la mise à jour des notifications:', err);
    }
  };

  const clearAllNotifications = async () => {
    if (window.confirm('Voulez-vous vraiment supprimer toutes vos notifications ?')) {
      try {
        const userId = user ? user.uid : null;
        if (!userId) return;
        const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', userId));
        const snapshot = await getDocs(notificationsQuery);
        await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
        setNotifications([]);
      } catch (err) {
        console.error('Erreur lors de la suppression des notifications:', err);
      }
    }
  };

  const formatOrderId = (orderId) => `C${orderId.slice(-4).padStart(4, '0')}`;
  const registerFCMToken = async (userId) => {
    try {
      const messaging = getMessaging();
      const token = await getToken(messaging, {
        vapidKey: "BHnVLhfreD5NmV_RYjOvSkJoh2NtJNV1hFOxi__f-SFz9Cf_iatVJC807jWukr6TicgDNHVx-rErZkWBA84rq88",
      });
      console.log("Token FCM:", token);
      await db.collection("usersrestau").doc(userId).set(
        { fcmToken: token },
        { merge: true }
      );
      return token;
    } catch (err) {
      console.error("Erreur lors de l'obtention du token FCM:", err);
    }
  };

  useEffect(() => {
    if (user) {
      registerFCMToken(user.uid);
    }
  }, [user]);

  // Recherche d'articles
  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
    setFilteredItems(filtered);
  };

  // Chargement initial des données
  useEffect(() => {
    fetchPublicData();

    if (user) {
      fetchPrivateData(user.uid);
      const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', user.uid));
      const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
        const newNotifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate(),
        })).sort((a, b) => b.timestamp - a.timestamp);
        setNotifications(newNotifications);

        if (newNotifications.some(n => !n.read) && !showNotificationModal) {
          setShowNotificationModal(true);
        }
      });
      return () => unsubscribeNotifications();
    }
  }, [user]);

  // Paramètres des sliders
  const promoSliderSettings = { dots: true, infinite: true, speed: 500, slidesToShow: 1, slidesToScroll: 1, autoplay: true };
  const itemSliderSettings = { dots: true, infinite: false, speed: 500, slidesToShow: 1, slidesToScroll: 1 };

  // Gestion des événements Facebook Pixel
  const handleViewContent = (item) => {
    if (window.fbq) {
      const selectedSize = selectedSizes[item.id];
      const price = item.priceType === 'sizes' && selectedSize ? item.sizes[selectedSize] : item.price;
      window.fbq('track', 'ViewContent', {
        content_ids: [item.id],
        content_name: item.name,
        content_type: 'product',
        value: convertPrice(price),
        currency: 'XAF',
      });
    } else {
      console.warn('Pixel Facebook non initialisé');
    }
  };

  // Sélection d'un article
  const handleAddClick = (item, e) => {
    e.preventDefault();
    console.log(`Ajout de ${item.id}, extraLists:`, item.extraLists);
    setSelectedItem({
      ...item,
      extraLists: item.extraLists || [],
      selectedSize: selectedSizes[item.id] || Object.keys(item.sizes || {})[0],
    });
    setSelectedExtras({});
  };

  // Validation des extras
  const validateExtras = () => {
    if (!selectedItem) {
      console.warn('validateExtras: selectedItem est null');
      return false;
    }
    if (selectedItem.priceType === 'sizes' && !selectedItem.selectedSize) {
      console.warn('validateExtras: aucune taille sélectionnée pour', selectedItem.id);
      return false;
    }
    const extraLists = Array.isArray(selectedItem.extraLists) ? selectedItem.extraLists : [];
    if (extraLists.length === 0) return true;
    return extraLists.every(extraListId => {
      const extraList = extraListsById[extraListId];
      if (!extraList) {
        console.warn(`ExtraList ${extraListId} non trouvée`);
        return true; // Ignorer les listes introuvables
      }
      const requiredElements = extraList.extraListElements?.filter(el => el.required) || [];
      if (requiredElements.length === 0) return true;
      const selected = selectedExtras[extraListId] || [];
      return selected.length > 0;
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

  // Ajout au panier
  const handleAddToCart = () => {
    if (validateExtras()) {
      const price = selectedItem.priceType === 'sizes' ? selectedItem.sizes[selectedItem.selectedSize] : selectedItem.price;
      addToCart({
        ...selectedItem,
        restaurantId: selectedItem.restaurantId || 'default_restaurant_id',
        selectedExtras,
        selectedSize: selectedItem.selectedSize,
        price,
      });
      setSuccessMessage(`${selectedItem.name} ajouté au panier !`);
      setTimeout(() => setSuccessMessage(''), 3000);

      if (window.fbq) {
        window.fbq('track', 'AddToCart', {
          content_ids: [selectedItem.id],
          content_name: selectedItem.name,
          content_type: 'product',
          value: calculateTotalPrice(),
          currency: 'XAF',
        });
      } else {
        console.warn('Pixel Facebook non initialisé');
      }

      setSelectedItem(null);
    } else {
      setSuccessMessage('Veuillez sélectionner une taille ou les extras requis.');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  // Calcul du prix total
  const calculateTotalPrice = () => {
    if (!selectedItem) return 0;
    let total = selectedItem.priceType === 'sizes'
      ? convertPrice(selectedItem.sizes[selectedItem.selectedSize || selectedSizes[selectedItem.id]])
      : convertPrice(selectedItem.price);
    if (isNaN(total)) total = 0;

    Object.entries(selectedExtras).forEach(([extraListId, indexes]) => {
      const extraList = extraListsById[extraListId];
      if (extraList) {
        indexes.forEach(index => {
          const extraPrice = convertPrice(extraList.extraListElements?.[index]?.price);
          total += isNaN(extraPrice) ? 0 : extraPrice;
        });
      }
    });
    return total;
  };

  // Filtrage des articles par jour
  const memoizedFilteredItems = useMemo(() => {
    return filteredItems.filter(item => item.scheduledDay?.includes(getCurrentDay()));
  }, [filteredItems]);

  // Gestion du chargement initial
  if (loading.global) {
    return <div className="flex justify-center items-center h-screen"><Loader /></div>;
  }

  // Gestion des erreurs
  if (error) {
    return (
      <div className="p-4 text-center bg-red-100 text-red-600 transition-opacity duration-500">
        {error} - <button onClick={() => fetchPublicData()} className="text-red-600 underline">Réessayer</button>
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

      {/* Modal pour les détails du produit */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{selectedItem.name}</h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <div className="mb-4">
                <p className="text-gray-600 text-sm">{selectedItem.description}</p>
                <div className="flex items-center mt-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm text-gray-600 ml-1">4.5 (120 avis)</span>
                </div>
              </div>

              {/* Sélection de taille si applicable */}
              {selectedItem.priceType === 'sizes' && selectedItem.sizes && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Choisissez votre taille</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedItem.sizes).map(([size, price]) => (
                      <motion.button
                        key={size}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedSizes(prev => ({ ...prev, [selectedItem.id]: size }))}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedSizes[selectedItem.id] === size
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-green-300'
                        }`}
                      >
                        <div className="font-medium">{size}</div>
                        <div className="text-sm text-gray-600">{convertPrice(price).toLocaleString()} FCFA</div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sélection des extras */}
              {selectedItem.extraLists && selectedItem.extraLists.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Personnalisez votre plat</h4>
                  {selectedItem.extraLists.map((extraListId) => {
                    const extraList = extraListsById[extraListId];
                    if (!extraList) return null;

                    return (
                      <div key={extraListId} className="mb-3">
                        <h5 className="text-sm font-medium text-gray-600 mb-2">{extraList.name}</h5>
                        <div className="space-y-2">
                          {extraList.extraListElements?.map((element, index) => (
                            <motion.label
                              key={index}
                              whileHover={{ scale: 1.02 }}
                              className="flex items-center space-x-3 p-2 rounded-lg border border-gray-200 hover:border-green-300 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedExtras[extraListId]?.includes(index) || false}
                                onChange={(e) => {
                                  const current = selectedExtras[extraListId] || [];
                                  const newSelection = e.target.checked
                                    ? [...current, index]
                                    : current.filter(i => i !== index);
                                  setSelectedExtras(prev => ({
                                    ...prev,
                                    [extraListId]: newSelection
                                  }));
                                }}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <span className="flex-1 text-sm">{element.name}</span>
                              {element.price && (
                                <span className="text-sm text-gray-600">+{convertPrice(element.price).toLocaleString()} FCFA</span>
                              )}
                            </motion.label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Prix total */}
              <div className="mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-800">Total</span>
                  <span className="text-2xl font-bold text-green-600">
                    {calculateTotalPrice().toLocaleString()} FCFA
                  </span>
                </div>
              </div>

              {/* Bouton Commander avec animation incitative */}
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 10px 25px rgba(34, 197, 94, 0.3)" }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddToCart}
                className="relative w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  initial={false}
                />
                <motion.span
                  className="relative z-10 flex items-center justify-center"
                  animate={{ x: [0, 2, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Ajouter à ma commande
                </motion.span>
                <motion.div
                  className="absolute inset-0 bg-white opacity-20"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* En-tête avec animations modulaires */}
      <motion.header 
        {...ANIMATION_VARIANTS.fadeInDown}
        className="bg-white border-b p-3 transition-all duration-300"
      >
        <div className="flex items-center">
          <Link to="/accueil" className="flex items-center no-underline text-black">
            <AnimatedComponents.AnimatedImage
              src={logo}
              alt="logo"
              className="h-8 mr-2"
              hoverZoom={false}
            />
            <h4 className="font-bold text-green-600 m-0">MANGE d'ABORD</h4>
          </Link>
          <div className="ml-auto flex items-center space-x-3">
            {/* Badge des points de fidélité */}
            <PointsBadge />
            
            <motion.button
              {...ANIMATION_VARIANTS.buttonPress}
              onClick={() => setShowNotificationModal(true)}
              className="bg-white p-1 rounded shadow-sm flex items-center hover:bg-gray-100 transition-colors duration-200"
            >
              <Bell className="w-5 h-5 text-gray-700" />
              {notifications.length > 0 && (
                <motion.span 
                  {...ANIMATION_VARIANTS.scaleIn}
                  className="bg-red-600 text-white text-xs px-1 rounded-full ml-1 animate-pulse"
                >
                  {notifications.filter(n => !n.read).length}
                </motion.span>
              )}
            </motion.button>
            <Link to="#" className="text-gray-700 hover:text-green-600 transition-colors duration-200">
              <Grid className="w-5 h-5" />
            </Link>
          </div>
        </div>
        <div className="mt-3 rounded shadow-sm overflow-hidden bg-white flex transition-all duration-300 focus-within:ring-2 focus-within:ring-green-500">
          <button className="bg-white p-2 border-0 text-green-600">
            <Search className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            className="flex-1 p-2 border-0 focus:outline-none"
            placeholder="Rechercher des plats ou restaurants..."
          />
        </div>
              </motion.header>

        {/* Section Conditionnelle : Fidélité ou Promotions */}
        {userPoints === 0 ? (
          <LoyaltyHero />
        ) : (
          <PromotionsHero />
        )}

        {/* Modal des notifications */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-transform duration-300 scale-95 hover:scale-100">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold">Notifications</h3>
              <button
                onClick={() => {
                  markAllNotificationsAsRead();
                  setShowNotificationModal(false);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {notifications.length === 0 ? (
                <p className="text-gray-500 text-center">Aucune notification pour le moment</p>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((notification) => (
                    <li
                      key={notification.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        notification.read ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200 hover:bg-green-100'
                      }`}
                      onClick={() => {
                        if (!notification.read) markNotificationAsRead(notification.id);
                        setShowNotificationModal(false);
                        window.location.href = `/complete_order/${notification.orderId}`;
                      }}
                    >
                      <p className="text-sm text-gray-700">
                        Commande #{formatOrderId(notification.orderId)} :{' '}
                        <span className={`font-medium ${STATUS_COLORS[notification.oldStatus]}`}>
                          {STATUS_LABELS[notification.oldStatus] || 'Nouveau'}
                        </span>{' '}
                        →{' '}
                        <span className={`font-medium ${STATUS_COLORS[notification.newStatus]}`}>
                          {STATUS_LABELS[notification.newStatus]}
                        </span>
                      </p>
                      {notification.newStatus === 'echec' && notification.reason && (
                        <p className="text-sm text-red-600 mt-1">Motif : {notification.reason}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{notification.timestamp.toLocaleString('fr-FR')}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearAllNotifications}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center"
                >
                  <i className="fas fa-trash-alt mr-1"></i> Vider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section des catégories avec animations modulaires */}
      <motion.section 
        {...scrollAnimation}
        className="p-3"
      >
        <motion.h6 
          {...ANIMATION_VARIANTS.fadeInUp}
          className="mb-2 font-medium"
        >
          Que recherchez-vous ?
        </motion.h6>
        {loading.categories ? (
          <Loader />
        ) : (
          <motion.div 
            className="grid grid-cols-4 gap-2"
            variants={CardAnimations.cardGridStagger.container}
            initial="initial"
            animate="animate"
          >
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                variants={CardAnimations.cardGridStagger.item}
                className="bg-white shadow-sm rounded text-center p-2"
                {...CardAnimations.categoryCardHover}
              >
                <Link to={`/category/${category.id}`}>
                  <motion.img 
                    src={category.icon} 
                    alt={category.name} 
                    className="w-10 h-10 mx-auto"
                    {...CardAnimations.productImageHover}
                  />
                  <p className="mt-2 text-sm text-gray-600">{category.name}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* Section Nos Menus avec animations modulaires */}
      <motion.section 
        {...scrollAnimation}
        className="p-3"
      >
        <motion.div 
          {...ANIMATION_VARIANTS.fadeInUp}
          className="flex items-center mb-2"
        >
          <h6 className="m-0 font-medium">Nos Menus</h6>
          <Link to="/menus" className="ml-auto text-green-600 hover:text-green-700 transition-colors duration-200">
            Voir plus
          </Link>
        </motion.div>
        {loading.menus ? (
          <Loader />
        ) : menus.length === 0 ? (
          <p className="text-gray-500 text-center">Aucun menu disponible pour le moment.</p>
        ) : (
          <motion.div 
            className="space-y-2"
            variants={CardAnimations.cardGridStagger.container}
            initial="initial"
            animate="animate"
          >
            {menus.slice(0, 5).map((menu, index) => (
              <motion.div
                key={menu.id}
                variants={CardAnimations.cardGridStagger.item}
                className="bg-white rounded-lg shadow-sm flex overflow-hidden"
                {...CardAnimations.menuCardHover}
              >
                <Link to={`/menu/${menu.id}`} className="flex w-full no-underline text-gray-800">
                  <div className="w-20 h-20 flex-shrink-0">
                    <motion.img
                      src={menu.covers[0] || 'https://via.placeholder.com/150?text=Aucune+image'}
                      alt={menu.name}
                      className="w-full h-full object-cover rounded-l-lg"
                      {...CardAnimations.productImageHover}
                      onError={(e) => (e.target.src = 'https://via.placeholder.com/150?text=Aucune+image')}
                    />
                  </div>
                  <div className="p-2 flex-1 flex flex-col justify-between">
                    <div>
                      <h6 className="font-semibold text-xs mb-1 line-clamp-1">{menu.name}</h6>
                      <p className="text-gray-600 text-xs line-clamp-1">{menu.description}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-green-600 text-xs font-medium">
                        {menu.price ? `${convertPrice(menu.price).toLocaleString()} Fcfa` : (
                          <span className="text-gray-500 italic"></span>
                        )}
                      </p>
                      <motion.button
                        className="text-green-600 text-xs font-medium hover:text-green-700 flex items-center"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <i className="fas fa-eye mr-1"></i> Détails
                      </motion.button>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* Section Sélection du jour avec animations modulaires */}
      <motion.section 
        {...scrollAnimation}
        className="px-3"
      >
        <motion.div 
          {...ANIMATION_VARIANTS.fadeInUp}
          className="flex items-center mt-4 mb-2"
        >
          <h6 className="m-0 font-medium">Sélection du jour</h6>
          <Link to="/picks_today" className="ml-auto text-green-600 hover:text-green-700 transition-colors duration-200">Voir plus</Link>
        </motion.div>
        {loading.items ? (
          <Loader />
        ) : memoizedFilteredItems.length === 0 ? (
          <p className="text-gray-500 text-center col-span-2">Aucun produit trouvé</p>
        ) : (
          <motion.div 
            className="grid grid-cols-2 gap-2"
            variants={CardAnimations.cardGridStagger.container}
            initial="initial"
            animate="animate"
          >
            {memoizedFilteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                variants={CardAnimations.cardGridStagger.item}
                className="bg-white rounded shadow-sm overflow-hidden relative"
                {...CardAnimations.productCardHover}
              >
                <Link
                  to={`/detail/${item.id}`}
                  className="no-underline text-black"
                  onClick={() => handleViewContent(item)}
                >
                  <div className="relative w-48 h-48 mx-auto bg-gray-100 rounded-t">
                    {/* Badge de promotion si applicable */}
                    {item.promo && (
                      <motion.div
                        className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10"
                        {...CardAnimations.promotionBadge}
                      >
                        -{item.promo}%
                      </motion.div>
                    )}
                    {item.covers?.length > 0 ? (
                      <Slider {...itemSliderSettings}>
                        {item.covers.map((cover, index) => (
                          <div key={index}>
                            <motion.img
                              src={cover}
                              alt={`${item.name} ${index + 1}`}
                              className="w-48 h-48 object-cover"
                              {...CardAnimations.productImageHover}
                            />
                          </div>
                        ))}
                      </Slider>
                    ) : (
                      <motion.img
                        src="/img/default.png"
                        alt={item.name}
                        className="w-48 h-48 object-cover"
                        {...CardAnimations.productImageHover}
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <h6 className="font-medium">{item.name}</h6>
                    {item.priceType === 'sizes' ? (
                      Object.keys(item.sizes || {}).length > 0 ? (
                        <p className="text-green-600 text-sm">
                          {Object.entries(item.sizes).map(([size, price]) => (
                            <span key={size}>
                              {size}: {convertPrice(price).toLocaleString()} Fcfa
                              {size !== Object.keys(item.sizes)[Object.keys(item.sizes).length - 1] ? ', ' : ''}
                            </span>
                          ))}
                        </p>
                      ) : (
                        <p className="text-red-600 text-sm">Aucune taille disponible</p>
                      )
                    ) : (
                      <motion.h6 
                        className="text-green-600 transition-all duration-200"
                        {...CardAnimations.priceAnimation}
                      >
                        {convertPrice(item.price).toLocaleString()} Fcfa
                      </motion.h6>
                    )}
                  </div>
                </Link>
                <motion.button
                  onClick={(e) => handleAddClick(item, e)}
                  className="bg-green-600 text-white px-2 py-1 rounded-full text-sm absolute bottom-2 right-2 hover:bg-green-700 transition-colors duration-200"
                  {...CardAnimations.addToCartButton}
                  aria-label={`Ajouter ${item.name} au panier avec options`}
                >
                  +
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.section>

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