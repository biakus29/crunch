import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CardAnimations } from '../utils/animationSystem';
import Slider from 'react-slick';

const ProductCard = ({ 
  item, 
  onAddClick, 
  onViewContent,
  showPromo = true,
  showAddButton = true 
}) => {
  const itemSliderSettings = { 
    dots: true, 
    infinite: false, 
    speed: 500, 
    slidesToShow: 1, 
    slidesToScroll: 1 
  };

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

  return (
    <motion.div
      className="bg-white rounded shadow-sm overflow-hidden relative"
      variants={CardAnimations.cardGridStagger.item}
      {...CardAnimations.productCardHover}
    >
      <Link
        to={`/detail/${item.id}`}
        className="no-underline text-black"
        onClick={() => onViewContent && onViewContent(item)}
      >
        <div className="relative w-48 h-48 mx-auto bg-gray-100 rounded-t">
          {/* Badge de promotion */}
          {showPromo && item.promo && (
            <motion.div
              className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10"
              {...CardAnimations.promotionBadge}
            >
              -{item.promo}%
            </motion.div>
          )}

          {/* Badge "Nouveau" si l'item est récent */}
          {item.isNew && (
            <motion.div
              className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ 
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
            >
              Nouveau
            </motion.div>
          )}

          {/* Badge "Populaire" si l'item est populaire */}
          {item.isPopular && (
            <motion.div
              className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ 
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
            >
              ⭐ Populaire
            </motion.div>
          )}

          {/* Images du produit */}
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
          {/* Nom du produit */}
          <motion.h6 
            className="font-medium"
            whileHover={{ color: "#059669" }}
            transition={{ duration: 0.2 }}
          >
            {item.name}
          </motion.h6>

          {/* Description du produit */}
          {item.description && (
            <motion.p 
              className="text-gray-600 text-sm mt-1 line-clamp-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {item.description}
            </motion.p>
          )}

          {/* Prix du produit */}
          <div className="mt-2">
            {item.priceType === 'sizes' ? (
              Object.keys(item.sizes || {}).length > 0 ? (
                <motion.p 
                  className="text-green-600 text-sm"
                  {...CardAnimations.priceAnimation}
                >
                  {Object.entries(item.sizes).map(([size, price]) => (
                    <span key={size}>
                      {size}: {convertPrice(price).toLocaleString()} Fcfa
                      {size !== Object.keys(item.sizes)[Object.keys(item.sizes).length - 1] ? ', ' : ''}
                    </span>
                  ))}
                </motion.p>
              ) : (
                <motion.p 
                  className="text-red-600 text-sm"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Aucune taille disponible
                </motion.p>
              )
            ) : (
              <motion.div className="flex items-center justify-between">
                <motion.h6 
                  className="text-green-600 font-semibold"
                  {...CardAnimations.priceAnimation}
                >
                  {convertPrice(item.price).toLocaleString()} Fcfa
                </motion.h6>
                
                {/* Prix barré si promotion */}
                {item.originalPrice && item.promo && (
                  <motion.span 
                    className="text-gray-500 line-through text-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    {convertPrice(item.originalPrice).toLocaleString()} Fcfa
                  </motion.span>
                )}
              </motion.div>
            )}
          </div>

          {/* Note et avis */}
          {item.rating && (
            <motion.div 
              className="flex items-center mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <motion.span
                    key={i}
                    className={`text-sm ${i < Math.floor(item.rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                    whileHover={{ scale: 1.2 }}
                    transition={{ duration: 0.1 }}
                  >
                    ★
                  </motion.span>
                ))}
              </div>
              <span className="text-gray-500 text-xs ml-1">
                ({item.ratingCount || 0} avis)
              </span>
            </motion.div>
          )}
        </div>
      </Link>

      {/* Bouton d'ajout au panier */}
      {showAddButton && (
        <motion.button
          onClick={(e) => onAddClick && onAddClick(item, e)}
          className="bg-green-600 text-white px-2 py-1 rounded-full text-sm absolute bottom-2 right-2 hover:bg-green-700 transition-colors duration-200"
          {...CardAnimations.addToCartButton}
          aria-label={`Ajouter ${item.name} au panier avec options`}
        >
          +
        </motion.button>
      )}

      {/* Bouton favori */}
      {item.isFavorite !== undefined && (
        <motion.button
          className="absolute top-2 right-2 bg-white bg-opacity-80 p-1 rounded-full"
          whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.95)" }}
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <motion.span
            className={`text-lg ${item.isFavorite ? 'text-red-500' : 'text-gray-400'}`}
            animate={item.isFavorite ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            ❤️
          </motion.span>
        </motion.button>
      )}
    </motion.div>
  );
};

export default ProductCard; 