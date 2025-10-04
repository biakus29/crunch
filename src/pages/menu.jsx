import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  ANIMATION_VARIANTS, 
  AnimatedComponents, 
  FoodAnimations, 
  CardAnimations,
  useScrollTrigger 
} from '../utils/animationSystem';
import { 
  Search, 
  Filter, 
  Star, 
  Heart, 
  ShoppingCart,
  ArrowLeft,
  Grid,
  List,
  MapPin,
  Clock, 
  Phone,
  X
} from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/cartcontext';
const ProductPoints = lazy(() => import('../components/ProductPoints'));
const PointsBadge = lazy(() => import('../components/PointsBadge'));

const MenuPage = () => {
  const { id: routeMenuId } = useParams();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extraLists, setExtraLists] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMenu, setSelectedMenu] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [showFilters, setShowFilters] = useState(false);
  const { cartItems, addToCart, updateQuantity, removeFromCart } = useCart();
  const [showCart, setShowCart] = useState(false);

  const scrollAnimation = useScrollTrigger();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer les catégories
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categoriesData = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCategories(categoriesData);

        // Récupérer les menus
        const menusSnapshot = await getDocs(collection(db, 'menus'));
        const menusData = menusSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMenus(menusData);

        // Récupérer tous les items
        const itemsSnapshot = await getDocs(collection(db, 'items'));

        // Récupérer toutes les listes d'extras
        const extraListsSnapshot = await getDocs(collection(db, 'extraLists'));
        const itemsData = itemsSnapshot.docs.map(doc => {
          const data = doc.data();
          // Normaliser les IDs de compléments attendus par ProductCard
          const extraIds = (Array.isArray(data.extraLists) && data.extraLists.length > 0)
            ? data.extraLists
            : (Array.isArray(data.assortments) ? data.assortments : []);
          return {
            id: doc.id,
            ...data,
            extraLists: extraIds,
          };
        });
        setItems(itemsData);
        setExtraLists(extraListsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Appliquer le filtre de menu depuis l'URL si présent
  useEffect(() => {
    if (routeMenuId) {
      setSelectedMenu(routeMenuId);
    }
  }, [routeMenuId]);

  // Filtrer et trier les items
  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
      const matchesMenu = selectedMenu === 'all' || item.menuId === selectedMenu;
      return matchesSearch && matchesCategory && matchesMenu;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price;
        case 'popular':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const handleDirectAdd = (item) => {
    // Ajout simple via le contexte global (sans compléments)
    addToCart({
      ...item,
      restaurantId: item.restaurantId || 'default_restaurant_id',
      selectedExtras: {},
      selectedSize: null,
      quantity: 1,
      price: item.price,
    });
  };

  const cartTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

  if (loading) {
    return (
      <AnimatedComponents.AnimatedPage className="min-h-screen bg-gray-100">
        <div className="flex items-center justify-center h-screen">
          <AnimatedComponents.AnimatedLoader type="spinner" size="large" color="green" />
        </div>
      </AnimatedComponents.AnimatedPage>
    );
  }

  return (
    <AnimatedComponents.AnimatedPage className="min-h-screen bg-gray-100 pb-20 overflow-x-hidden">
      {/* Header - Mobile First */}
      <motion.header
        {...ANIMATION_VARIANTS.fadeInDown}
        className="bg-white border-b sticky top-0 z-50 px-4 py-3 md:px-6 md:py-4"
      >
        {/* Top row - Navigation */}
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <Link to="/" className="flex items-center space-x-2 md:space-x-3">
            <motion.button
              {...ANIMATION_VARIANTS.buttonPress}
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </motion.button>
            <h1 className="text-lg font-bold text-gray-900 md:text-xl lg:text-2xl">
              Menu Complet
            </h1>
          </Link>
          
          <div className="flex items-center space-x-2 md:space-x-3">
            <Suspense fallback={<div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-green-600 animate-spin" />}> 
              <PointsBadge />
            </Suspense>
            <motion.button
              {...ANIMATION_VARIANTS.buttonPress}
              onClick={() => setShowCart(true)}
              className="relative p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200"
            >
              <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
              {cartItems.length > 0 && (
                <motion.span 
                  {...ANIMATION_VARIANTS.scaleIn}
                  className="absolute -top-1 -right-1 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium min-w-[20px]"
                >
                  {cartItems.reduce((total, item) => total + item.quantity, 0)}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>

        {/* Search Bar - Full width on mobile */}
        <motion.div
          className="relative mb-3 md:mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
          <input
            type="text"
            placeholder="Rechercher un plat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base placeholder-gray-500 md:py-3.5 md:text-lg"
          />
        </motion.div>

        {/* Controls - Responsive layout */}
        <motion.div
          className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Filter and View Controls */}
          <div className="flex items-center justify-between md:justify-start md:space-x-4">
            <div className="flex items-center space-x-2">
              <motion.button
                {...ANIMATION_VARIANTS.buttonPress}
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 md:px-5 md:py-2.5 ${
                  showFilters 
                    ? 'bg-green-600 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filtres</span>
              </motion.button>
              
              {/* View mode toggle - Hide on small screens if needed */}
              <div className="hidden xs:flex items-center bg-gray-100 rounded-lg p-1">
                <motion.button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-all duration-200 ${
                    viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Grid className="w-4 h-4" />
                </motion.button>
                <motion.button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-all duration-200 ${
                    viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <List className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent md:px-5 md:py-2.5"
            >
              <option value="name">Nom</option>
              <option value="price">Prix</option>
              <option value="popular">Popularité</option>
            </select>
          </div>
        </motion.div>

        {/* Advanced Filters - Collapsible */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-gray-50 rounded-xl overflow-hidden"
            >
              <h3 className="font-semibold mb-3 text-gray-900">Catégories</h3>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedCategory === 'all' 
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-green-300 hover:bg-green-50'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Tous
                </motion.button>
                {categories.map((category) => (
                  <motion.button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      selectedCategory === category.id
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-green-300 hover:bg-green-50'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {category.name}
                  </motion.button>
                ))}
              </div>

              {/* Menus */}
              <h3 className="font-semibold mt-6 mb-3 text-gray-900">Menus</h3>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  onClick={() => setSelectedMenu('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedMenu === 'all'
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-green-300 hover:bg-green-50'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Tous les menus
                </motion.button>
                {menus.map((m) => (
                  <motion.button
                    key={m.id}
                    onClick={() => setSelectedMenu(m.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      selectedMenu === m.id
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-green-300 hover:bg-green-50'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {m.name}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Main Content */}
      <motion.section
        {...scrollAnimation}
        className="p-4 md:p-6 lg:p-8"
      >
        {/* Statistics - Mobile first grid */}
        <motion.div
          className="mb-6 grid grid-cols-3 gap-3 md:gap-4 lg:gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="bg-white p-3 rounded-xl text-center shadow-sm hover:shadow-md transition-shadow duration-200 md:p-4 lg:p-6">
            <div className="text-xl font-bold text-green-600 md:text-2xl lg:text-3xl">
              {filteredItems.length}
            </div>
            <div className="text-xs text-gray-600 mt-1 md:text-sm lg:text-base">
              Plats disponibles
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl text-center shadow-sm hover:shadow-md transition-shadow duration-200 md:p-4 lg:p-6">
            <div className="text-xl font-bold text-green-600 md:text-2xl lg:text-3xl">
              {categories.length}
            </div>
            <div className="text-xs text-gray-600 mt-1 md:text-sm lg:text-base">
              Catégories
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl text-center shadow-sm hover:shadow-md transition-shadow duration-200 md:p-4 lg:p-6">
            <div className="text-xl font-bold text-green-600 md:text-2xl lg:text-3xl">
              {cartItems.length}
            </div>
            <div className="text-xs text-gray-600 mt-1 md:text-sm lg:text-base">
              Dans le panier
            </div>
          </div>
        </motion.div>

        {/* Products Grid - Responsive */}
        <motion.div
          className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 gap-4 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
              : "space-y-4"
          }
          variants={CardAnimations.cardGridStagger.container}
          initial="initial"
          animate="animate"
        >
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              variants={CardAnimations.cardGridStagger.item}
              className={viewMode === 'list' ? 'relative overflow-hidden bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200' : ''}
            >
              <ProductCard
                product={item}
                onAddToCart={handleDirectAdd}
                showPromo
                showAddButton
                viewMode={viewMode}
                extraLists={extraLists}
              />
              <Suspense fallback={<div className="h-6" />}>
                <ProductPoints total={item.price} />
              </Suspense>
            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <motion.div
            className="text-center py-16 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4 md:w-20 md:h-20" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2 md:text-xl">
              Aucun plat trouvé
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto md:text-lg">
              Essayez de modifier vos critères de recherche
            </p>
          </motion.div>
        )}
      </motion.section>

      {/* Cart Modal - Full screen on mobile */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center md:justify-center md:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCart(false)}
          >
            <motion.div
              className="bg-white rounded-t-2xl w-full max-h-[90vh] overflow-hidden md:rounded-2xl md:max-w-lg md:max-h-[85vh]"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 500 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b md:p-6">
                <h2 className="text-xl font-bold md:text-2xl">Votre Panier</h2>
                <motion.button
                  onClick={() => setShowCart(false)}
                  className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>

              {/* Modal Content */}
              <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(90vh-140px)] md:max-h-[calc(85vh-140px)]">
                {cartItems.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4 md:w-20 md:h-20" />
                    <p className="text-gray-500 md:text-lg">Votre panier est vide</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-6">
                      {cartItems.map((item) => (
                        <motion.div
                          key={item.id}
                          className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl md:p-4"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          <img
                            src={item.covers?.[0] || "/img/default.png"}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-lg md:w-20 md:h-20"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate md:text-lg">{item.name}</h3>
                            <p className="text-sm text-gray-600 md:text-base">
                              {item.price.toLocaleString()} FCFA
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <motion.button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 bg-gray-200 text-gray-700 rounded-full flex items-center justify-center font-bold md:w-10 md:h-10"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              -
                            </motion.button>
                            <span className="w-8 text-center font-semibold md:w-10 md:text-lg">
                              {item.quantity}
                            </span>
                            <motion.button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold md:w-10 md:h-10"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              +
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Cart Footer */}
                    <div className="border-t pt-4 md:pt-6">
                      <div className="flex justify-between items-center mb-4 md:mb-6">
                        <span className="font-semibold text-lg md:text-xl">Total:</span>
                        <span className="text-xl font-bold text-green-600 md:text-2xl">
                          {cartTotal.toLocaleString()} FCFA
                        </span>
                      </div>
                      <Link to="/panier">
                        <motion.button
                          className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-green-700 transition-colors duration-200 md:text-xl"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowCart(false)}
                        >
                          Commander ({cartItems.length} article{cartItems.length > 1 ? 's' : ''})
                        </motion.button>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatedComponents.AnimatedPage>
  );
};

export default MenuPage;