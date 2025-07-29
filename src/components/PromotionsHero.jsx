import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CardAnimations, FoodAnimations } from '../utils/animationSystem';
import { 
  Star, 
  Gift, 
  TrendingUp, 
  Users, 
  Award,
  ChevronRight,
  Sparkles,
  Clock,
  Tag,
  Percent,
  Flame,
  Zap,
  Heart,
  ShoppingBag,
  Calendar,
  MapPin,
  Truck
} from 'lucide-react';

const PromotionsHero = () => {
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  // Promotions dynamiques
  const promotions = [
    {
      id: 1,
      title: "🎉 Offre Spéciale -50%",
      subtitle: "Sur tous les plats populaires",
      description: "Profitez de nos meilleurs plats à moitié prix !",
      validUntil: "2024-12-31",
      code: "POPULAR50",
      color: "from-red-500 to-pink-500",
      icon: Flame,
      badge: "LIMITÉ"
    },
    {
      id: 2,
      title: "🚚 Livraison Gratuite",
      subtitle: "Commande minimum 8000 FCFA",
      description: "Plus de frais de livraison sur vos grosses commandes !",
      validUntil: "2024-12-25",
      code: "FREESHIP",
      color: "from-green-500 to-emerald-500",
      icon: Truck,
      badge: "NOUVEAU"
    },
    {
      id: 3,
      title: "💝 Menu Famille -30%",
      subtitle: "Parfait pour 4-6 personnes",
      description: "Économisez sur nos menus familiaux !",
      validUntil: "2024-12-28",
      code: "FAMILY30",
      color: "from-purple-500 to-indigo-500",
      icon: Users,
      badge: "POPULAIRE"
    },
    {
      id: 4,
      title: "⚡ Flash Sale -40%",
      subtitle: "Seulement aujourd'hui",
      description: "Offre éclair sur une sélection de plats !",
      validUntil: "2024-12-20",
      code: "FLASH40",
      color: "from-orange-500 to-red-500",
      icon: Zap,
      badge: "FLASH"
    }
  ];

  useEffect(() => {
    const fetchUserPoints = async () => {
      try {
        if (auth.currentUser) {
          const userDoc = await getDoc(doc(db, 'usersrestau', auth.currentUser.uid));
          if (userDoc.exists()) {
            const points = userDoc.data().points || 0;
            setUserPoints(points);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des points:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserPoints();
  }, []);

  // Rotation automatique des promotions
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % promotions.length);
    }, 5000); // Change toutes les 5 secondes

    return () => clearInterval(interval);
  }, [promotions.length]);

  const currentPromo = promotions[currentPromoIndex];

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 py-8 px-4 mb-6"
    >
      <div className="max-w-7xl mx-auto">
        {/* En-tête de la section */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full mb-4"
            {...FoodAnimations.serving}
          >
            <Gift className="w-8 h-8 text-white" />
          </motion.div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Promotions Exclusives
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Découvrez nos offres spéciales et économisez sur vos commandes !
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Promotion principale animée */}
          <motion.div
            className="relative"
            key={currentPromo.id}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className={`bg-gradient-to-r ${currentPromo.color} rounded-2xl p-6 text-white shadow-xl relative overflow-hidden`}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              {/* Badge de promotion */}
              <motion.div
                className="absolute top-4 right-4 bg-white bg-opacity-20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold"
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {currentPromo.badge}
              </motion.div>

              {/* Icône animée */}
              <motion.div
                className="mb-4"
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <currentPromo.icon className="w-12 h-12" />
              </motion.div>

              <h3 className="text-2xl font-bold mb-2">{currentPromo.title}</h3>
              <p className="text-lg mb-3 opacity-90">{currentPromo.subtitle}</p>
              <p className="text-sm mb-4 opacity-80">{currentPromo.description}</p>

              {/* Code promo */}
              <motion.div
                className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-3 mb-4"
                whileHover={{ scale: 1.05 }}
              >
                <p className="text-xs opacity-80 mb-1">Code promo :</p>
                <p className="font-mono font-bold text-lg">{currentPromo.code}</p>
              </motion.div>

              {/* Date de validité */}
              <div className="flex items-center space-x-2 text-sm opacity-80">
                <Clock className="w-4 h-4" />
                <span>Valide jusqu'au {currentPromo.validUntil}</span>
              </div>

              {/* Bouton d'action */}
              <motion.button
                className="w-full bg-white text-purple-600 py-3 rounded-lg font-semibold mt-4 hover:bg-gray-100 transition-colors"
                {...CardAnimations.addToCartButton}
              >
                <div className="flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 mr-2" />
                  Profiter de l'offre
                  <ChevronRight className="w-4 h-4 ml-2" />
                </div>
              </motion.button>
            </motion.div>

            {/* Indicateurs de rotation */}
            <div className="flex justify-center space-x-2 mt-4">
              {promotions.map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => setCurrentPromoIndex(index)}
                  className={`w-2 h-2 rounded-full ${
                    index === currentPromoIndex ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                />
              ))}
            </div>
          </motion.div>

          {/* Autres promotions */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              Autres offres disponibles
            </h3>
            
            {promotions.filter((_, index) => index !== currentPromoIndex).slice(0, 3).map((promo, index) => (
              <motion.div
                key={promo.id}
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <div className="flex items-start space-x-3">
                  <motion.div
                    className={`flex-shrink-0 w-10 h-10 bg-gradient-to-r ${promo.color} rounded-full flex items-center justify-center`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <promo.icon className="w-5 h-5 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{promo.title}</h4>
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">
                        {promo.badge}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{promo.subtitle}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Code: {promo.code}</span>
                      <motion.button
                        className="text-purple-600 hover:text-purple-800 text-sm font-semibold"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Voir détails
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Statistiques des promotions */}
            <motion.div
              className="grid grid-cols-2 gap-4 mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{promotions.length}</div>
                <div className="text-xs text-gray-600">Promotions actives</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-pink-600">-50%</div>
                <div className="text-xs text-gray-600">Réduction max</div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Call-to-action */}
        <motion.div
          className="text-center mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <p className="text-sm text-gray-600 mb-4">
            N'oubliez pas de saisir vos codes promo lors de la commande !
          </p>
          <Link to="/menu">
            <motion.button
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Voir le menu
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default PromotionsHero; 