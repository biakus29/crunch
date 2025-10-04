import React, { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Star, Clock, Heart, Flame, Award } from 'lucide-react';
const AddToCartModal = lazy(() => import('./AddToCartModal'));

const ProductCard = ({ product, onAddToCart, className = '', viewMode = 'grid', showPromo = false, extraLists = [] }) => {
  const {
    name,
    description,
    price,
    image,
    covers,
    category,
    rating = 4.5,
    preparationTime = '15-20 min',
    isAvailable = true,
    isPopular = false,
    discount = 0,
    originalPrice
  } = product;

  // Support both `isAvailable` (legacy) and `available` (admin) flags
  const availability = product?.isAvailable ?? product?.available ?? isAvailable;

  const [isFavorite, setIsFavorite] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState(null);
  const imageUrl = covers?.[0] || image || '/api/placeholder/400/400';
  const finalPrice = discount > 0 ? price * (1 - discount / 100) : price;

  const handleAddToCart = () => {
    if (availability) {
      // Normaliser la liste d'IDs de compléments (supporte extraLists ou assortments)
      const extraIds = (product.extraLists && product.extraLists.length > 0)
        ? product.extraLists
        : (product.assortments || []);
      // Ouvrir le modal si le produit a des compléments OU s'il utilise des tailles
      const hasExtras = Array.isArray(extraIds) && extraIds.length > 0;
      const hasSizes = product.priceType === 'sizes';
      if (hasExtras || hasSizes) {
        setSelectedItem({
          ...product,
          extraLists: extraIds
        });
      } else {
        // Sinon, ajouter directement au panier (flux parent)
        if (onAddToCart) {
          onAddToCart(product);
        }
      }
    }
  };

  // Succès du modal: rien à faire ici, l'ajout est géré dans le modal via le contexte global
  const handleAddToCartSuccess = () => {};

  const toggleFavorite = (e) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        className={`bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 overflow-hidden ${className}`}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex p-6 md:p-8 min-h-[180px] md:min-h-[220px]">
          {/* Image plus grande */}
          <div className="relative w-32 h-32 md:w-44 md:h-44 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
            />
            {!availability && (
              <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-2xl">
                <span className="text-white text-sm font-bold">Indisponible</span>
              </div>
            )}
            {isPopular && availability && (
              <div className="absolute -top-2 -left-2">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-2 rounded-full shadow-lg">
                  <Flame className="w-5 h-5" />
                </div>
              </div>
            )}
          </div>

          {/* Content avec plus d'espace */}
          <div className="flex-1 ml-6 md:ml-8 flex flex-col justify-between py-2">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 line-clamp-2 md:text-2xl lg:text-3xl leading-tight mb-2">
                    {name}
                  </h3>
                  {category && (
                    <span className="inline-block bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 px-4 py-2 rounded-full text-sm font-semibold">
                      {category}
                    </span>
                  )}
                </div>
                <motion.button
                  onClick={toggleFavorite}
                  className="ml-4 p-3 rounded-full hover:bg-gray-100 flex-shrink-0 shadow-md"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Heart 
                    className={`w-6 h-6 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`}
                  />
                </motion.button>
              </div>

              <p className="text-gray-600 text-base md:text-lg leading-relaxed line-clamp-3">
                {description || "Délicieux plat préparé avec des ingrédients frais et de qualité. Une explosion de saveurs qui ravira vos papilles."}
              </p>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(rating) 
                          ? 'text-yellow-400 fill-current' 
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="text-base text-gray-700 ml-2 font-semibold">({rating})</span>
                </div>
                <div className="flex items-center text-gray-600 text-base">
                  <Clock className="w-5 h-5 mr-2" />
                  <span className="font-medium">{preparationTime}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="space-y-1">
                {discount > 0 && originalPrice && (
                  <span className="text-base text-gray-500 line-through block">
                    {originalPrice?.toLocaleString()} FCFA
                  </span>
                )}
                <div className="flex items-center space-x-3">
                  <span className="text-3xl font-bold text-orange-600 md:text-4xl">
                    {finalPrice?.toLocaleString()} FCFA
                  </span>
                  {discount > 0 && (
                    <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm px-3 py-1 rounded-full font-bold shadow-lg">
                      -{discount}%
                    </span>
                  )}
                </div>
              </div>

              <motion.button
                onClick={handleAddToCart}
                disabled={!availability}
                className={`px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 flex items-center space-x-3 shadow-lg md:px-10 md:py-5 md:text-lg ${
                  availability
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:shadow-2xl transform hover:-translate-y-1'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                whileHover={availability ? { scale: 1.05 } : {}}
                whileTap={availability ? { scale: 0.95 } : {}}
              >
                <ShoppingCart className="w-5 h-5" />
                <span>
                  {availability ? 'Ajouter' : 'Indisponible'}
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid View - Cards VRAIMENT épaisses et imposantes
  return (
    <motion.div
      className={`bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 border-2 border-gray-100 hover:border-orange-200 overflow-hidden relative group ${className}`}
      style={{ minHeight: '480px' }} // Force une hauteur minimale importante
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -12, scale: 1.03 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Image Container - Beaucoup plus haute */}
      <div className="relative h-72 md:h-80 lg:h-[320px] overflow-hidden">
        <motion.img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          loading="lazy"
        />
        
        {/* Gradient overlay plus prononcé */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
        
        {/* Badges repositionnés et plus gros */}
        <div className="absolute top-4 left-4 flex flex-col space-y-3">
          {isPopular && availability && (
            <motion.div
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-2xl text-sm font-bold flex items-center space-x-2 shadow-xl"
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <Flame className="w-4 h-4" />
              <span>Populaire</span>
            </motion.div>
          )}
          {discount > 0 && (
            <motion.div
              className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-2xl text-sm font-bold shadow-xl"
              initial={{ scale: 0, rotate: 10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              -{discount}%
            </motion.div>
          )}
          {rating >= 4.5 && (
            <motion.div
              className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-2 rounded-2xl text-sm font-bold shadow-xl flex items-center space-x-1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: "spring" }}
            >
              <Award className="w-4 h-4" />
              <span>Top</span>
            </motion.div>
          )}
        </div>

        {/* Category badge en haut à droite */}
        {category && (
          <div className="absolute top-4 right-4">
            <span className="bg-white/95 backdrop-blur-sm text-gray-800 px-4 py-2 rounded-2xl text-sm font-bold shadow-lg">
              {category}
            </span>
          </div>
        )}

        {/* Favorite button plus gros */}
        <motion.button
          onClick={toggleFavorite}
          className="absolute bottom-4 right-4 p-3 rounded-2xl bg-white/95 backdrop-blur-sm hover:bg-white shadow-xl border border-gray-200"
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
        >
          <Heart 
            className={`w-6 h-6 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-600'}`}
          />
        </motion.button>

        {/* Unavailable overlay */}
        {!availability && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-xl">
              <span className="text-gray-800 font-bold text-lg">Non disponible</span>
            </div>
          </div>
        )}
      </div>

      {/* Content - Beaucoup plus d'espace et de contenu */}
      <div className="p-6 md:p-8 space-y-6 flex-1 flex flex-col">
        {/* Title and Category */}
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-gray-900 line-clamp-2 leading-tight md:text-2xl lg:text-3xl">
            {name}
          </h3>
          
          {/* Rating plus visible */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 md:w-6 md:h-6 ${
                      i < Math.floor(rating) 
                        ? 'text-yellow-400 fill-current' 
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-base text-gray-700 font-bold md:text-lg">({rating})</span>
            </div>
            <div className="flex items-center text-gray-600 text-base md:text-lg">
              <Clock className="w-5 h-5 mr-2" />
              <span className="font-semibold">{preparationTime}</span>
            </div>
          </div>
        </div>

        {/* Description plus longue */}
        <div className="flex-1">
          <p className="text-gray-600 text-base md:text-lg leading-relaxed line-clamp-4">
            {description || "Savourez ce délicieux plat préparé avec des ingrédients frais et de qualité premium. Une explosion de saveurs authentiques qui ravira vos papilles et vous transportera dans un voyage culinaire inoubliable."}
          </p>
        </div>

        {/* Price Section plus imposante */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="space-y-2">
            {discount > 0 && originalPrice && (
              <span className="text-lg text-gray-500 line-through block font-medium">
                {originalPrice.toLocaleString()} FCFA
              </span>
            )}
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-orange-600 md:text-4xl lg:text-5xl">
                {finalPrice?.toLocaleString()} FCFA
              </span>
              {discount > 0 && (
                <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-base px-4 py-2 rounded-2xl font-bold shadow-lg">
                  -{discount}%
                </span>
              )}
            </div>
          </div>

          {/* Add to Cart Button plus gros et imposant */}
          <motion.button
            onClick={handleAddToCart}
            disabled={!availability}
            className={`w-full flex items-center justify-center px-8 py-5 rounded-2xl font-bold transition-all duration-400 text-lg md:text-xl md:py-6 shadow-xl ${
              availability
                ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:shadow-2xl transform hover:-translate-y-2'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            whileHover={availability ? { scale: 1.02 } : {}}
            whileTap={availability ? { scale: 0.98 } : {}}
          >
            <ShoppingCart className="w-6 h-6 mr-3" />
            {availability ? 'Ajouter au panier' : 'Non disponible'}
          </motion.button>

          {/* Modal pour l'ajout au panier avec compléments */}
          <Suspense fallback={null}>
            <AddToCartModal
              isOpen={!!selectedItem}
              onClose={() => setSelectedItem(null)}
              item={selectedItem}
              extraLists={extraLists}
              onSuccess={handleAddToCartSuccess}
            />
          </Suspense>
        </div>
      </div>

      {/* Hover effect border plus visible */}
      <div className="absolute inset-0 rounded-3xl ring-4 ring-orange-500/30 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none" />
      
      {/* Glow effect au hover */}
      <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl" />
    </motion.div>
  );
};

export default React.memo(ProductCard);