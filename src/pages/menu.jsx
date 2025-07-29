import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
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
  Phone
} from 'lucide-react';
import ProductCard from '../components/ProductCard';
import ProductPoints from '../components/ProductPoints';
import PointsBadge from '../components/PointsBadge';

const MenuPage = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price', 'popular'
  const [showFilters, setShowFilters] = useState(false);
  const [cart, setCart] = useState([]);
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

        // Récupérer tous les items
        const itemsSnapshot = await getDocs(collection(db, 'items'));
        const itemsData = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setItems(itemsData);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
    };

    fetchData();
  }, []);

  // Filtrer et trier les items
  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
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

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prev.map(cartItem => 
          cartItem.id === item.id 
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

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
    <AnimatedComponents.AnimatedPage className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <motion.header
        {...ANIMATION_VARIANTS.fadeInDown}
        className="bg-white border-b p-4 sticky top-0 z-40"
      >
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <motion.button
              {...ANIMATION_VARIANTS.buttonPress}
              className="p-2 rounded-full hover:bg-gray-100"
            >
          <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <h1 className="text-xl font-bold text-gray-900">Menu Complet</h1>
        </Link>
          
          <div className="flex items-center space-x-3">
            <PointsBadge />
            <motion.button
              {...ANIMATION_VARIANTS.buttonPress}
              onClick={() => setShowCart(true)}
              className="relative p-2 rounded-full hover:bg-gray-100"
            >
          <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
            <motion.span 
                  {...ANIMATION_VARIANTS.scaleIn}
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
            >
                  {cart.reduce((total, item) => total + item.quantity, 0)}
            </motion.span>
          )}
            </motion.button>
          </div>
        </div>

        {/* Barre de recherche */}
        <motion.div
          className="mt-4 relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher un plat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        </motion.div>

        {/* Filtres et tri */}
        <motion.div
          className="mt-4 flex items-center justify-between"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center space-x-2">
            <motion.button
              {...ANIMATION_VARIANTS.buttonPress}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm ${
                showFilters ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filtres</span>
            </motion.button>
            
            <div className="flex items-center space-x-1 bg-gray-200 rounded-lg p-1">
          <motion.button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
                <Grid className="w-4 h-4" />
          </motion.button>
            <motion.button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              >
                <List className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
          >
            <option value="name">Nom</option>
            <option value="price">Prix</option>
            <option value="popular">Popularité</option>
          </select>
        </motion.div>

        {/* Filtres avancés */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-gray-50 rounded-lg"
            >
              <h3 className="font-semibold mb-3">Catégories</h3>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedCategory === 'all' 
                  ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 border'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
            >
              Tous
            </motion.button>
            {categories.map((category) => (
              <motion.button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                    className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === category.id
                    ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 border'
                }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
              >
                {category.name}
              </motion.button>
            ))}
          </div>
            </motion.div>
        )}
        </AnimatePresence>
      </motion.header>

      {/* Contenu principal */}
      <motion.section
        {...scrollAnimation}
        className="p-4"
      >
        {/* Statistiques */}
          <motion.div
          className="mb-6 grid grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="bg-white p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{filteredItems.length}</div>
            <div className="text-xs text-gray-600">Plats disponibles</div>
          </div>
          <div className="bg-white p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{categories.length}</div>
            <div className="text-xs text-gray-600">Catégories</div>
          </div>
          <div className="bg-white p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-600">{cart.length}</div>
            <div className="text-xs text-gray-600">Dans le panier</div>
          </div>
          </motion.div>

        {/* Grille des produits */}
        <motion.div
          className={viewMode === 'grid' 
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
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
              className={viewMode === 'list' ? 'bg-white rounded-lg shadow-sm' : ''}
            >
              <ProductCard
                item={item}
                onAddClick={addToCart}
                showPromo={true}
                showAddButton={true}
              />
              {/* Badge des points gagnés */}
              <ProductPoints total={item.price} />
                </motion.div>
              ))}
        </motion.div>

        {/* Message si aucun résultat */}
        {filteredItems.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Aucun plat trouvé
            </h3>
            <p className="text-gray-500">
              Essayez de modifier vos critères de recherche
            </p>
          </motion.div>
        )}
      </motion.section>

      {/* Modal du panier */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end"
            onClick={() => setShowCart(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white rounded-t-2xl p-6 w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Votre Panier</h2>
                <motion.button
                  onClick={() => setShowCart(false)}
                  className="p-2 rounded-full hover:bg-gray-100"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
            </div>

              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Votre panier est vide</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <motion.div
                        key={item.id}
                        className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <img
                          src={item.covers?.[0] || "/img/default.png"}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="text-sm text-gray-600">
                            {item.price.toLocaleString()} FCFA
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <motion.button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            -
                          </motion.button>
                          <span className="w-8 text-center font-semibold">
                            {item.quantity}
                          </span>
                          <motion.button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            +
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-semibold">Total:</span>
                      <span className="text-xl font-bold text-green-600">
                        {cartTotal.toLocaleString()} FCFA
                      </span>
                    </div>
                    <Link to="/panier">
                      <motion.button
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Commander ({cart.length} articles)
                      </motion.button>
                    </Link>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatedComponents.AnimatedPage>
  );
};

export default MenuPage;