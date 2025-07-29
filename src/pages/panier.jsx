import React, { useMemo, useEffect, useState } from "react";
import { useCart } from "../context/cartcontext";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowLeft, 
  CreditCard, 
  Package, 
  MapPin, 
  Phone, 
  User, 
  Check,
  AlertCircle,
  Info,
  Star,
  Clock,
  Home,
  Heart,
  Settings,
  Bell,
  Edit,
  Save
} from 'lucide-react';
import "@fortawesome/fontawesome-free/css/all.min.css";

// ==================== Loaders Personnalisés ====================
const CartLoader = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center h-40"
  >
    <div className="relative">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 rounded-full border-4 border-green-400 border-t-transparent"
      ></motion.div>
      <motion.div 
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <ShoppingCart className="w-8 h-8 text-green-500" />
      </motion.div>
    </div>
    <motion.p 
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="mt-4 text-green-600 font-semibold"
    >
      Chargement du panier...
    </motion.p>
  </motion.div>
);

const EmptyCartLoader = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center h-40"
  >
    <motion.div 
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"
    >
      <ShoppingCart className="w-8 h-8 text-gray-400" />
    </motion.div>
    <motion.p 
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="mt-4 text-gray-500 font-semibold"
    >
      Votre panier est vide
    </motion.p>
  </motion.div>
);

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity } = useCart();
  const navigate = useNavigate();
  const [extraLists, setExtraLists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch extras
  useEffect(() => {
    const fetchExtraLists = async () => {
      try {
        setIsLoading(true);
        const querySnapshot = await getDocs(collection(db, "extraLists"));
        setExtraLists(
          querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (error) {
        console.error("Error fetching extras:", error);
        toast.error("Erreur lors du chargement des extras.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchExtraLists();
  }, []);

  const getExtraDetails = (extraListId, elementIndex) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    if (!extraList || !extraList.extraListElements) {
      return { name: "Option inconnue", price: 0 };
    }
    const element = extraList.extraListElements[elementIndex];
    return {
      name: element?.name || "Option supprimée",
      price: element?.price || 0,
    };
  };

  const convertPrice = (price) => {
    if (typeof price === "string") {
      return parseFloat(price.replace(/\./g, ""));
    }
    return Number(price);
  };

  // Calculate total
  const total = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      let itemTotal = convertPrice(item.price) * item.quantity;
      if (item.selectedExtras) {
        Object.entries(item.selectedExtras).forEach(([extraListId, indexes]) => {
          indexes.forEach((index) => {
            const { price } = getExtraDetails(extraListId, index);
            itemTotal += convertPrice(price) * item.quantity;
          });
        });
      }
      return acc + itemTotal;
    }, 0);
  }, [cartItems, extraLists]);

  const thresholdAmount = 5000;

  // Calculate loyalty points
  const points = useMemo(() => {
    if (total >= thresholdAmount) {
      const credit = total * 0.1;
      return Math.floor(credit / 100);
    }
    return 0;
  }, [total]);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.warn("Votre panier est vide. Ajoutez des articles avant de commander.");
      return;
    }

    const restaurantId = cartItems[0]?.restaurantId;
    if (!restaurantId) {
      toast.error("Erreur : Aucun restaurant associé au panier.");
      return;
    }

    const allSameRestaurant = cartItems.every(
      (item) => item.restaurantId === restaurantId
    );
    if (!allSameRestaurant) {
      toast.error("Vous ne pouvez commander que depuis un seul restaurant à la fois.");
      return;
    }

    navigate("/order-details", { state: { restaurantId } });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <CartLoader />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 sm:px-6">
        <EmptyCartLoader />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
        <Link
          to="/accueil"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
            <Home className="w-5 h-5 mr-2" />
            Découvrir nos plats
        </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </motion.button>
          <h1 className="text-xl font-bold text-gray-800">Mon Panier</h1>
          <div className="w-8"></div>
        </div>
      </header>

        {/* Cart Items */}
      <div className="p-4 space-y-4">
        <AnimatePresence>
          {cartItems.map((item, index) => (
            <motion.div
              key={`${item.id}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-xl shadow-sm p-4"
            >
              <div className="flex items-start space-x-4">
                <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0">
                  {item.covers?.[0] ? (
                    <img
                      src={item.covers[0]}
                alt={item.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">
                    {item.name}
                  </h3>
                  <p className="text-gray-500 text-xs sm:text-sm mt-1">
                  {convertPrice(item.price).toLocaleString()} FCFA
                </p>

                  {/* Extras display */}
                  {item.selectedExtras && Object.keys(item.selectedExtras).length > 0 && (
                    <div className="mt-2">
                      {Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
                        <div key={extraListId} className="text-xs text-gray-600">
                          {indexes.map((index) => {
                            const { name } = getExtraDetails(extraListId, index);
                            return <span key={index} className="mr-2">+ {name}</span>;
                          })}
                        </div>
                      ))}
                  </div>
                )}
                </div>

                <div className="flex flex-col items-end space-y-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                  
                  <div className="flex items-center space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </motion.button>
                    
                    <span className="w-8 text-center font-semibold text-gray-800">
                    {item.quantity}
                  </span>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center hover:bg-green-200 transition-colors"
                  >
                      <Plus className="w-4 h-4 text-green-600" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
            </div>

      {/* Loyalty Points */}
      {points > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Star className="w-5 h-5 text-yellow-500 mr-2" />
              <span className="text-sm font-medium text-yellow-800">
                Points fidélité gagnés : {points}
              </span>
            </div>
            <motion.span
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full"
            >
              +{points} pts
            </motion.span>
          </div>
        </motion.div>
      )}

      {/* Checkout Section */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-30">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <span className="font-semibold text-base sm:text-lg md:text-xl text-gray-700">
              Total :
            </span>
            <span className="font-bold text-xl sm:text-2xl md:text-3xl text-green-600">
              {total.toLocaleString()} FCFA
            </span>
          </div>
          
          {/* Bouton Commander avec animation incitative */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 10px 25px rgba(34, 197, 94, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCheckout}
            className="relative w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2.5 sm:py-3 md:py-4 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center text-sm sm:text-base md:text-lg overflow-hidden group"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-green-500 to-green-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              initial={false}
            />
            <motion.span
              className="relative z-10 flex items-center"
              animate={{ x: [0, 2, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Check className="mr-2 h-5 w-5" />
            Commander maintenant
            </motion.span>
            <motion.div
              className="absolute inset-0 bg-white opacity-20"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            />
          </motion.button>
        </div>
      </footer>

      {/* Navigation */}
      <nav className="fixed bottom-16 w-full bg-white shadow-lg p-2 sm:p-3 grid grid-cols-4 text-center z-20">
        <Link
          to="/accueil"
          className="py-2 text-gray-600 hover:text-green-600 transition-colors"
        >
          <Home className="text-base sm:text-lg md:text-xl mb-1" />
          <span className="block text-xs sm:text-sm">Boutique</span>
        </Link>
        <Link
          to="/cart"
          className="py-2 text-green-600 font-semibold"
        >
          <ShoppingCart className="text-base sm:text-lg md:text-xl mb-1" />
          <span className="block text-xs sm:text-sm">Panier</span>
        </Link>
        <Link
          to="/orders"
          className="py-2 text-gray-600 hover:text-green-600 transition-colors"
        >
          <Package className="text-base sm:text-lg md:text-xl mb-1" />
          <span className="block text-xs sm:text-sm">Commandes</span>
        </Link>
        <Link
          to="/profile"
          className="py-2 text-gray-600 hover:text-green-600 transition-colors"
        >
          <User className="text-base sm:text-lg md:text-xl mb-1" />
          <span className="block text-xs sm:text-sm">Compte</span>
        </Link>
      </nav>

      <ToastContainer />
    </div>
  );
};

export default CartPage;