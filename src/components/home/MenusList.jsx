import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const MenusList = ({ menus = [], loading = false, scrollAnimation, ANIMATION_VARIANTS, CardAnimations, convertPrice }) => {
  return (
    <motion.section 
      {...(scrollAnimation || {})}
      className="p-3"
    >
      <motion.div 
        {...(ANIMATION_VARIANTS?.fadeInUp || {})}
        className="flex items-center mb-2"
      >
        <h6 className="m-0 font-medium">Nos Menus</h6>
        <Link to="/menu" className="ml-auto text-green-600 hover:text-green-700 transition-colors duration-200">
          Voir plus
        </Link>
      </motion.div>
      {loading ? (
        <div className="flex items-center justify-center py-6">Chargement...</div>
      ) : menus.length === 0 ? (
        <p className="text-gray-500 text-center">Aucun menu disponible pour le moment.</p>
      ) : (
        <motion.div 
          className="space-y-2"
          variants={CardAnimations?.cardGridStagger?.container}
          initial="initial"
          animate="animate"
        >
          {menus.slice(0, 5).map((menu) => (
            <motion.div
              key={menu.id}
              variants={CardAnimations?.cardGridStagger?.item}
              className="bg-white rounded-lg shadow-sm flex overflow-hidden"
              {...(CardAnimations?.menuCardHover || {})}
            >
              <Link to={`/menus/${menu.id}`} className="flex w-full no-underline text-gray-800">
                <div className="w-20 h-20 flex-shrink-0">
                  <motion.img
                    src={menu.covers[0] || 'https://via.placeholder.com/150?text=Aucune+image'}
                    alt={menu.name}
                    className="w-full h-full object-cover rounded-l-lg"
                    {...(CardAnimations?.productImageHover || {})}
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
  );
};

export default MenusList;
