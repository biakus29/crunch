import React, { useEffect, useState } from 'react';
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

const STATUS_LABELS = {
  "en_attente": "En attente",
  "en_preparation": "En préparation",
  "pret_a_livrer": "Prêt à livrer",
  "en_livraison": "En livraison",
  "livree": "Livrée",
  "echec": "Échec",
};

const STATUS_COLORS = {
  "en_attente": "text-yellow-600",
  "en_preparation": "text-blue-600",
  "pret_a_livrer": "text-purple-600",
  "en_livraison": "text-orange-600",
  "livree": "text-green-600",
  "echec": "text-red-600",
};

const HomePage = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [promos, setPromos] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState({ global: true, categories: true, items: true, promos: true });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { addToCart, cartItems } = useCart();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(prev => ({ ...prev, global: false }));
      if (currentUser && window.fbq) {
        window.fbq('track', 'PageView'); // Optionnel si géré par React Router
      }
    }, (err) => {
      setError("Erreur lors de la vérification de l'utilisateur");
      setLoading(prev => ({ ...prev, global: false }));
    });
    return () => unsubscribeAuth();
  }, []);

  const fetchPublicData = async () => {
    try {
      const [categoriesSnap, itemsSnap, promosSnap, extraListsSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'items')),
        getDocs(collection(db, 'promos')),
        getDocs(collection(db, 'extraLists')),
      ]);

      setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setItems(itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setFilteredItems(itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setPromos(promosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setExtraLists(extraListsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      setLoading(prev => ({ ...prev, categories: false, items: false, promos: false }));
    } catch (err) {
      setError('Erreur de chargement des données');
      setLoading(prev => ({ ...prev, categories: false, items: false, promos: false }));
    }
  };

  const fetchPrivateData = async (userId) => {
    try {
      const ordersSnap = await getDocs(query(collection(db, 'orders'), where('userId', '==', userId)));
      setOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setError('Erreur de chargement des commandes');
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
      setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, read: true } : n)));
    } catch (err) {
      console.error("Erreur lors de la mise à jour de la notification:", err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(unreadNotifications.map(n => markNotificationAsRead(n.id)));
    } catch (err) {
      console.error("Erreur lors de la mise à jour des notifications:", err);
    }
  };

  const clearAllNotifications = async () => {
    if (window.confirm("Voulez-vous vraiment supprimer toutes vos notifications ?")) {
      try {
        const userId = user ? user.uid : null;
        if (!userId) return;
        const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', userId));
        const snapshot = await getDocs(notificationsQuery);
        await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
        setNotifications([]);
      } catch (err) {
        console.error("Erreur lors de la suppression des notifications:", err);
      }
    }
  };

  const formatOrderId = (orderId) => `C${orderId.slice(-4).padStart(4, '0')}`;

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    const filtered = items.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.description?.toLowerCase().includes(query)
    );
    setFilteredItems(filtered);
  };

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

  const promoSliderSettings = { dots: true, infinite: true, speed: 500, slidesToShow: 1, slidesToScroll: 1, autoplay: true };
  const itemSliderSettings = { dots: true, infinite: false, speed: 500, slidesToShow: 1, slidesToScroll: 1 };

  // Événement ViewContent
  const handleViewContent = (item) => {
    if (window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_ids: [item.id],
        content_name: item.name,
        content_type: 'product',
        value: convertPrice(item.price),
        currency: 'XAF',
      });
    } else {
      console.warn("Pixel Facebook non initialisé");
    }
  };

  const handleAddClick = (item, e) => {
    e.preventDefault();
    if (item.assortments?.length > 0) {
      setSelectedItem(item);
      setSelectedExtras({});
    } else {
      addToCart({ ...item, restaurantId: item.restaurantId || "default_restaurant_id" });
      setSuccessMessage(`${item.name} ajouté au panier !`);
      setTimeout(() => setSuccessMessage(''), 3000);

      // Événement AddToCart
      if (window.fbq) {
        window.fbq('track', 'AddToCart', {
          content_ids: [item.id],
          content_name: item.name,
          content_type: 'product',
          value: convertPrice(item.price),
          currency: 'XAF',
        });
      } else {
        console.warn("Pixel Facebook non initialisé");
      }
    }
  };

  const validateExtras = () => {
    if (!selectedItem) return false;
    return selectedItem.assortments.every(assortmentId => {
      const extraList = extraLists.find(el => el.id === assortmentId);
      const requiredElements = extraList?.extraListElements?.filter(el => el.required) || [];
      if (requiredElements.length === 0) return true;
      const selected = selectedExtras[assortmentId] || [];
      return selected.length > 0;
    });
  };

  const getCurrentDay = () => ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][new Date().getDay()];
  const convertPrice = (price) => {
    if (!price) return 0; // Gestion des cas où price est undefined ou null
    return typeof price === 'string' ? parseFloat(price.replace(/\./g, '')) : Number(price);
  };

  const calculateTotalPrice = () => {
    let total = selectedItem ? convertPrice(selectedItem.price) : 0;
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

  const handleAddToCart = () => {
    if (validateExtras()) {
      addToCart({ ...selectedItem, restaurantId: selectedItem.restaurantId || "default_restaurant_id", selectedExtras });
      setSuccessMessage(`${selectedItem.name} ajouté au panier !`);
      setTimeout(() => setSuccessMessage(''), 3000);

      // Événement AddToCart avec extras
      if (window.fbq) {
        window.fbq('track', 'AddToCart', {
          content_ids: [selectedItem.id],
          content_name: selectedItem.name,
          content_type: 'product',
          value: calculateTotalPrice(),
          currency: 'XAF',
        });
      } else {
        console.warn("Pixel Facebook non initialisé");
      }

      setSelectedItem(null);
    }
  };

  const Loader = () => (
    <div className="flex justify-center items-center h-32">
      <i className="fas fa-spinner fa-spin text-4xl text-green-600 animate-spin"></i>
    </div>
  );

  if (loading.global) {
    return <div className="flex justify-center items-center h-screen"><Loader /></div>;
  }

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

      <header className="bg-white border-b p-3 transition-all duration-300">
        <div className="flex items-center">
          <Link to="/" className="flex items-center no-underline text-black">
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
                  {notifications.map((notification, index) => (
                    <li
                      key={index}
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
                          {STATUS_LABELS[notification.oldStatus] || "Nouveau"}
                        </span>{' '}
                        →{' '}
                        <span className={`font-medium ${STATUS_COLORS[notification.newStatus]}`}>
                          {STATUS_LABELS[notification.newStatus]}
                        </span>
                      </p>
                      {notification.newStatus === "echec" && notification.reason && (
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

      <section className="px-3">
        <div className="flex items-center mt-4 mb-2">
          <h6 className="m-0 font-medium">Sélection du jour</h6>
          <Link to="/picks_today" className="ml-auto text-green-600 hover:text-green-700 transition-colors duration-200">Voir plus</Link>
        </div>
        {loading.items ? (
          <Loader />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredItems.length === 0 ? (
              <p className="text-gray-500 text-center col-span-2">Aucun produit trouvé</p>
            ) : (
              filteredItems
                .filter(item => item.scheduledDay?.includes(getCurrentDay()))
                .map((item) => (
                  <div key={item.id} className="bg-white rounded shadow-sm overflow-hidden relative transition-transform duration-300 hover:scale-105">
                    <Link
                      to={`/detail/${item.id}`}
                      className="no-underline text-black"
                      onClick={() => handleViewContent(item)} // Ajout de ViewContent
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
                        <h6 className="text-green-600">{convertPrice(item.price).toLocaleString()} Fcfa</h6>
                      </div>
                    </Link>
                    <button
                      onClick={(e) => handleAddClick(item, e)}
                      className="bg-green-600 text-white px-2 py-1 rounded-full text-sm absolute bottom-2 right-2 hover:bg-green-700 transition-colors duration-200"
                    >
                      +
                    </button>
                  </div>
                ))
            )}
          </div>
        )}
      </section>

      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-transform duration-300 scale-95 hover:scale-100">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold">Options disponibles</h3>
              <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>
            <div className="p-4">
              {selectedItem.assortments.map(assortmentId => {
                const extraList = extraLists.find(el => el.id === assortmentId);
                if (!extraList) return null;

                return (
                  <div key={extraList.id} className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">
                      {extraList.name}
                      {extraList.extraListElements?.some(el => el.required) && <span className="text-red-500 ml-1">*</span>}
                    </h4>
                    <div className="space-y-2">
                      {extraList.extraListElements?.map((el, index) => (
                        <label
                          key={index}
                          className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            selectedExtras[assortmentId]?.includes(index) ? 'bg-green-50 border-2 border-green-200' : 'border border-gray-200 hover:border-green-200'
                          }`}
                        >
                          <input
                            type={el.multiple ? "checkbox" : "radio"}
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
                  </div>
                );
              })}
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

      <footer className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg">
        <div className="grid grid-cols-4">
          <Link to="/" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
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