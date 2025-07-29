import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  Sparkles
} from 'lucide-react';

const LoyaltyHero = () => {
  const [userPoints, setUserPoints] = useState(0);
  const [userLevel, setUserLevel] = useState('Bronze');
  const [loading, setLoading] = useState(true);

  // Calcul du niveau utilisateur
  const calculateLevel = (points) => {
    if (points >= 200) return { name: 'Platine', color: 'text-purple-600', bgColor: 'bg-purple-100' };
    if (points >= 100) return { name: 'Or', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    if (points >= 50) return { name: 'Argent', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    return { name: 'Bronze', color: 'text-orange-600', bgColor: 'bg-orange-100' };
  };

  // Points nécessaires pour le prochain niveau
  const getNextLevel = (points) => {
    if (points < 50) return { name: 'Argent', required: 50 - points };
    if (points < 100) return { name: 'Or', required: 100 - points };
    if (points < 200) return { name: 'Platine', required: 200 - points };
    return { name: 'Max', required: 0 };
  };

  useEffect(() => {
    const fetchUserPoints = async () => {
      try {
        if (auth.currentUser) {
          const userDoc = await getDoc(doc(db, 'usersrestau', auth.currentUser.uid));
          if (userDoc.exists()) {
            const points = userDoc.data().points || 0;
            setUserPoints(points);
            setUserLevel(calculateLevel(points));
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

  const nextLevel = getNextLevel(userPoints);
  const levelInfo = calculateLevel(userPoints);

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="bg-gradient-to-br from-green-50 via-green-100 to-green-200 py-8 px-4 mb-6"
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
            className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4"
            {...FoodAnimations.serving}
          >
            <Star className="w-8 h-8 text-white" />
          </motion.div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Programme de Fidélité
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Gagnez des points sur chaque commande et profitez d'avantages exclusifs !
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Carte utilisateur avec points */}
          <motion.div
            className="bg-white rounded-2xl p-6 shadow-lg"
            {...CardAnimations.productCardHover}
          >
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <motion.div
                  className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full"
                  {...FoodAnimations.cooking}
                />
              </div>
            ) : (
              <>
                {/* En-tête de la carte */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {auth.currentUser ? 'Vos Points' : 'Rejoignez le Programme'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {auth.currentUser ? 'Solde actuel' : 'Commencez à gagner des points'}
                    </p>
                  </div>
                  <motion.div
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${levelInfo.bgColor} ${levelInfo.color}`}
                    whileHover={{ scale: 1.05 }}
                  >
                    {levelInfo.name}
                  </motion.div>
                </div>

                {/* Affichage des points */}
                <motion.div
                  className="text-center mb-6"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.div
                    className="text-4xl font-bold text-green-600 mb-2"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      color: ["#059669", "#10B981", "#059669"]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {userPoints}
                  </motion.div>
                  <p className="text-sm text-gray-600">points</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Équivaut à {userPoints * 100} FCFA
                  </p>
                </motion.div>

                {/* Barre de progression */}
                {nextLevel.required > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progression</span>
                      <span>{nextLevel.required} points restants</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                      <motion.div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${Math.min(100, ((userPoints % 50) / 50) * 100)}%` 
                        }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Prochain niveau : {nextLevel.name}
                    </p>
                  </div>
                )}

                {/* Bouton d'action */}
                {auth.currentUser ? (
                  <Link to="/profile?tab=points">
                    <motion.button
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                      {...CardAnimations.addToCartButton}
                    >
                      <div className="flex items-center justify-center">
                        <Star className="w-5 h-5 mr-2" />
                        Voir mes points
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </div>
                    </motion.button>
                  </Link>
                ) : (
                  <Link to="/login">
                    <motion.button
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                      {...CardAnimations.addToCartButton}
                    >
                      <div className="flex items-center justify-center">
                        <Sparkles className="w-5 h-5 mr-2" />
                        Commencer à gagner
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </div>
                    </motion.button>
                  </Link>
                )}
              </>
            )}
          </motion.div>

          {/* Avantages du programme */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              Pourquoi rejoindre ?
            </h3>
            
            {[
              {
                icon: Gift,
                title: "Points sur chaque commande",
                description: "Gagnez 10% sur votre première commande, puis 5% sur les suivantes"
              },
              {
                icon: TrendingUp,
                title: "Réduction automatique",
                description: "1 point = 100 FCFA de réduction sur vos commandes"
              },
              {
                icon: Award,
                title: "Niveaux et avantages",
                description: "Montez en niveau et débloquez des avantages exclusifs"
              },
              {
                icon: Users,
                title: "Programme exclusif",
                description: "Accès à des offres spéciales et des événements VIP"
              }
            ].map((advantage, index) => (
              <motion.div
                key={index}
                className="flex items-start space-x-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <motion.div
                  className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <advantage.icon className="w-5 h-5 text-green-600" />
                </motion.div>
                <div>
                  <h4 className="font-semibold text-gray-900">{advantage.title}</h4>
                  <p className="text-sm text-gray-600">{advantage.description}</p>
                </div>
              </motion.div>
            ))}

            {/* Statistiques rapides */}
            <motion.div
              className="grid grid-cols-2 gap-4 mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">5000</div>
                <div className="text-xs text-gray-600">FCFA minimum</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">100</div>
                <div className="text-xs text-gray-600">FCFA par point</div>
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
            Commandez dès maintenant et commencez à gagner des points !
          </p>
          <Link to="/menu">
            <motion.button
              className="bg-white text-green-600 border-2 border-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-green-600 hover:text-white transition-all"
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

export default LoyaltyHero; 