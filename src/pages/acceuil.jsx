import React, { useEffect, useState, useMemo } from 'react';
import Slider from 'react-slick';
import { Link } from 'react-router-dom';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { collection, getDocs, onSnapshot, doc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useCart } from '../context/cartcontext';
import { onAuthStateChanged } from 'firebase/auth';
import logo from '../image/logo.png';
import '@fortawesome/fontawesome-free/css/all.min.css';

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

const HomePage = () => {
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
  const [searchQuery, setSearchQuery] = useState('');
  const { addToCart, cartItems } = useCart();

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
    }, (err) => {
      setError('Erreur lors de la vérification de l’utilisateur');
      setLoading(prev => ({ ...prev, global: false }));
    });
    return () => unsubscribeAuth();
  }, []);

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
          assortments: doc.data().assortments || [],
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

      console.log('Articles chargés:', fetchedItems);
      console.log('Menus chargés:', fetchedMenus);

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
    console.log(`Ajout de ${item.id}, assortments:`, item.assortments);
    setSelectedItem({
      ...item,
      assortments: item.assortments || [],
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
    const assortments = Array.isArray(selectedItem.assortments) ? selectedItem.assortments : [];
    if (assortments.length === 0) return true;
    return assortments.every(assortmentId => {
      const extraList = extraLists.find(el => el.id === assortmentId);
      const requiredElements = extraList?.extraListElements?.filter(el => el.required) || [];
      if (requiredElements.length === 0) return true;
      const selected = selectedExtras[assortmentId] || [];
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

    Object.entries(selectedExtras).forEach(([assortmentId, indexes]) => {
      const extraList = extraLists.find(el => el.id === assortmentId);
      if (extraList) {
        indexes.forEach(index => {
          const extraPrice = convertPrice(extraList.extraListElements?.[index]?.price);
          total += isNaN(extraPrice) ? 0 : extraPrice;
        });
      }
    });
    return total;
  };

  // Composant Loader
  const Loader = () => (
    <div className="flex justify-center items-center h-32">
      <i className="fas fa-spinner fa-spin text-4xl text-green-600 animate-spin"></i>
    </div>
  );

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
    <div className="min-h-screen bg-gray-100 pb-20">
      {successMessage && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">
          {successMessage}
        </div>
      )}

      {/* En-tête */}
      <header className="bg-white border-b p-3 transition-all duration-300">
        <div className="flex items-center">
          <Link to="/accueil" className="flex items-center no-underline text-black">
            <img src={logo} alt="logo" className="h-8 mr-2 transition-transform duration-300 hover:scale-105" />
            <h4 className="font-bold text-green-600 m-0">MANGE d'ABORD</h4>
          </Link>
          <div className="ml-auto flex items-center">
            <button
              onClick={() => setShowNotificationModal(true)}
              className="bg-white p-1 rounded shadow-sm flex items-center hover:bg-gray-100 transition-colors duration-200"
            >
              <i className="fas fa-bell text-lg text-gray-700"></i>
              {notifications.length > 0 && (
                <span className="bg-red-600 text-white text-xs px-1 rounded-full ml-1 animate-pulse">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            <Link to="#" className="ml-3 text-gray-700 hover:text-green-600 transition-colors duration-200">
              <i className="fas fa-bars text-xl"></i>
            </Link>
          </div>
        </div>
        <div className="mt-3 rounded shadow-sm overflow-hidden bg-white flex transition-all duration-300 focus-within:ring-2 focus-within:ring-green-500">
          <button className="bg-white p-2 border-0 text-green-600">
            <i className="fas fa-search"></i>
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            className="flex-1 p-2 border-0 focus:outline-none"
            placeholder="Rechercher des plats ou restaurants..."
          />
        </div>
      </header>

      {/* Modal des notifications */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-transform duration-300 scale-95 hover:scale-100">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold">Notifications</h3>
              <div className="flex gap-2">
                <button onClick={clearAllNotifications} className="text-red-600 hover:text-red-800 text-sm">
                  <i className="fas fa-trash-alt"></i> Vider
                </button>
                <button onClick={() => { markAllNotificationsAsRead(); setShowNotificationModal(false); }} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
              </div>
            </div>
            <div className="p-4">
              {notifications.length === 0 ? (
                <p className="text-gray-500 text-center">Aucune notification pour le moment</p>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((notification) => (
                    <li
                      key={notification.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${notification.read ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200 hover:bg-green-100'}`}
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
            </div>
          </div>
        </div>
      )}

      {/* Section des catégories */}
      <section className="p-3">
        <h6 className="mb-2 font-medium">Que recherchez-vous ?</h6>
        {loading.categories ? (
          <Loader />
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {categories.map((category) => (
              <div key={category.id} className="bg-white shadow-sm rounded text-center p-2 transition-transform duration-300 hover:scale-105">
                <Link to={`/category/${category.id}`}>
                  <img src={category.icon} alt={category.name} className="w-10 h-10 mx-auto" />
                  <p className="mt-2 text-sm text-gray-600">{category.name}</p>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section Nos Menus */}
      <section className="p-3">
        <div className="flex items-center mb-2">
          <h6 className="m-0 font-medium">Nos Menus</h6>
          <Link to="/menus" className="ml-auto text-green-600 hover:text-green-700 transition-colors duration-200">
            Voir plus
          </Link>
        </div>
        {loading.menus ? (
          <Loader />
        ) : menus.length === 0 ? (
          <p className="text-gray-500 text-center">Aucun menu disponible pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {menus.slice(0, 5).map((menu) => (
              <div
                key={menu.id}
                className="bg-white rounded-lg shadow-sm flex overflow-hidden transition-transform duration-300 hover:scale-[1.01]"
              >
                <Link to={`/menu/${menu.id}`} className="flex w-full no-underline text-gray-800">
                  <div className="w-20 h-20 flex-shrink-0">
                    <img
                      src={menu.covers[0] || 'https://via.placeholder.com/150?text=Aucune+image'}
                      alt={menu.name}
                      className="w-full h-full object-cover rounded-l-lg"
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
                      <button className="text-green-600 text-xs font-medium hover:text-green-700 flex items-center">
                        <i className="fas fa-eye mr-1"></i> Détails
                      </button>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section Sélection du jour */}
      <section className="px-3">
        <div className="flex items-center mt-4 mb-2">
          <h6 className="m-0 font-medium">Sélection du jour</h6>
          <Link to="/picks_today" className="ml-auto text-green-600 hover:text-green-700 transition-colors duration-200">Voir plus</Link>
        </div>
        {loading.items ? (
          <Loader />
        ) : memoizedFilteredItems.length === 0 ? (
          <p className="text-gray-500 text-center col-span-2">Aucun produit trouvé</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {memoizedFilteredItems.map((item) => (
              <div key={item.id} className="bg-white rounded shadow-sm overflow-hidden relative transition-transform duration-300 hover:scale-105">
                <Link
                  to={`/detail/${item.id}`}
                  className="no-underline text-black"
                  onClick={() => handleViewContent(item)}
                >
                  <div className="relative w-48 h-48 mx-auto bg-gray-100 rounded-t">
                    {item.covers?.length > 0 ? (
                      <Slider {...itemSliderSettings}>
                        {item.covers.map((cover, index) => (
                          <div key={index}>
                            <img src={cover} alt={`${item.name} ${index + 1}`} className="w-48 h-48 object-cover" />
                          </div>
                        ))}
                      </Slider>
                    ) : (
                      <img src="/img/default.png" alt={item.name} className="w-48 h-48 object-cover" />
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
                      <h6 className="text-green-600 transition-all duration-200">
                        {convertPrice(item.price).toLocaleString()} Fcfa
                      </h6>
                    )}
                  </div>
                </Link>
                <button
                  onClick={(e) => handleAddClick(item, e)}
                  className="bg-green-600 text-white px-2 py-1 rounded-full text-sm absolute bottom-2 right-2 hover:bg-green-700 transition-colors duration-200"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal de sélection des options */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-transform duration-300 scale-95 hover:scale-100">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold">Options pour {selectedItem.name}</h3>
              <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>
            <div className="p-4">
              {selectedItem.priceType === 'sizes' && (
                Object.keys(selectedItem.sizes || {}).length > 0 ? (
                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">Choisir une taille <span className="text-red-500">*</span></h4>
                    <div className="space-y-2">
                      {Object.entries(selectedItem.sizes).map(([size, price]) => (
                        <label
                          key={size}
                          className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            (selectedItem.selectedSize || selectedSizes[selectedItem.id] || Object.keys(selectedItem.sizes)[0]) === size
                              ? 'bg-green-50 border-2 border-green-200'
                              : 'border border-gray-200 hover:border-green-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="size"
                            value={size}
                            checked={(selectedItem.selectedSize || selectedSizes[selectedItem.id] || Object.keys(selectedItem.sizes)[0]) === size}
                            onChange={(e) => {
                              const newSize = e.target.value;
                              setSelectedItem({ ...selectedItem, selectedSize: newSize });
                              setSelectedSizes((prev) => ({
                                ...prev,
                                [selectedItem.id]: newSize,
                              }));
                            }}
                            className="form-radio h-5 w-5 text-green-600 focus:ring-green-500"
                          />
                          <div className="ml-3 flex-1">
                            <span className="text-gray-700">{size}</span>
                            <span className="text-sm text-gray-500 ml-2">{convertPrice(price).toLocaleString()} Fcfa</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-red-600 text-sm">Aucune taille disponible</p>
                )
              )}
              {selectedItem.assortments?.length > 0 ? (
                selectedItem.assortments.map(assortmentId => {
                  const extraList = extraLists.find(el => el.id === assortmentId);
                  if (!extraList) {
                    console.warn(`ExtraList ${assortmentId} non trouvée pour ${selectedItem.id}`);
                    return <p key={assortmentId} className="text-red-600 text-sm">Extra indisponible</p>;
                  }
                  return (
                    <div key={extraList.id} className="mb-6">
                      <h4 className="font-medium mb-3 text-gray-700">
                        {extraList.name}
                        {extraList.extraListElements?.some(el => el.required) && <span className="text-red-500 ml-1">*</span>}
                      </h4>
                      {extraList.extraListElements?.length > 0 ? (
                        <div className="space-y-2">
                          {extraList.extraListElements.map((el, index) => (
                            <label
                              key={index}
                              className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                                selectedExtras[assortmentId]?.includes(index) ? 'bg-green-50 border-2 border-green-200' : 'border border-gray-200 hover:border-green-200'
                              }`}
                            >
                              <input
                                type={el.multiple ? 'checkbox' : 'radio'}
                                checked={selectedExtras[assortmentId]?.includes(index)}
                                onChange={(e) => {
                                  const newSelection = [...(selectedExtras[assortmentId] || [])];
                                  if (el.multiple) {
                                    e.target.checked ? newSelection.push(index) : newSelection.splice(newSelection.indexOf(index), 1);
                                  } else {
                                    newSelection.length = 0;
                                    newSelection.push(index);
                                  }
                                  setSelectedExtras({ ...selectedExtras, [assortmentId]: newSelection });
                                }}
                                className="form-checkbox h-5 w-5 text-green-600 focus:ring-green-500"
                              />
                              <div className="ml-3 flex-1">
                                <span className="text-gray-700">{el.name}</span>
                                {el.price && <span className="text-sm text-gray-500 ml-2">+ {convertPrice(el.price).toLocaleString()} FCFA</span>}
                              </div>
                              {el.required && <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">Obligatoire</span>}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-red-600 text-sm">Aucun élément extra disponible</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-sm">Aucun extra disponible</p>
              )}
              <div className="mt-6 flex gap-3">
                <button onClick={() => setSelectedItem(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex-1 transition-colors duration-200">Annuler</button>
                <button
                  onClick={handleAddToCart}
                  disabled={!validateExtras()}
                  className={`px-4 py-2 rounded-lg flex-1 transition-all duration-200 ${
                    validateExtras() ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Confirmer ({calculateTotalPrice().toLocaleString()} FCFA)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pied de page */}
      <footer className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg">
        <div className="grid grid-cols-4">
          <Link to="/accueil" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <i className="fas fa-home text-lg"></i><span className="block text-xs mt-1">Accueil</span>
          </Link>
          <Link to="/cart" className="relative text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <i className="fas fa-shopping-cart text-lg"></i>
            {cartItems.length > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-green-600 rounded-full animate-pulse">{cartItems.length}</span>
            )}
            <span className="block text-xs mt-1">Panier</span>
          </Link>
          <Link to="/complete_order" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <i className="fas fa-shopping-bag text-lg"></i><span className="block text-xs mt-1">Commandes</span>
          </Link>
          <Link to="/profile" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <i className="fas fa-user text-lg"></i><span className="block text-xs mt-1">Compte</span>
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;