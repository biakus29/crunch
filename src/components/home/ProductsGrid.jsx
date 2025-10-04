import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Slider from 'react-slick';

const ProductsGrid = ({
  title = 'Sélection du jour',
  viewMoreHref = '/picks_today',
  items = [],
  loading = false,
  scrollAnimation,
  ANIMATION_VARIANTS,
  CardAnimations,
  itemSliderSettings,
  convertPrice,
  onViewContent,
  onAddClick,
}) => {
  return (
    <motion.section {...(scrollAnimation || {})} className="px-3">
      <motion.div {...(ANIMATION_VARIANTS?.fadeInUp || {})} className="flex items-center mt-4 mb-2">
        <h6 className="m-0 font-medium">{title}</h6>
        <Link to={viewMoreHref} className="ml-auto text-green-600 hover:text-green-700 transition-colors duration-200">
          Voir plus
        </Link>
      </motion.div>
      {loading ? (
        <div className="flex items-center justify-center py-6">Chargement...</div>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-center col-span-2">Aucun produit trouvé</p>
      ) : (
        <motion.div
          className="grid grid-cols-2 gap-2"
          variants={CardAnimations?.cardGridStagger?.container}
          initial="initial"
          animate="animate"
        >
          {items
            .slice()
            .sort((a, b) => {
              const aAvail = (a?.available ?? a?.isAvailable ?? true) ? 1 : 0;
              const bAvail = (b?.available ?? b?.isAvailable ?? true) ? 1 : 0;
              return bAvail - aAvail; // disponibles en premier
            })
            .map((item) => {
              const isAvail = item?.available ?? item?.isAvailable ?? true;
              return (
            <motion.div
              key={item.id}
              variants={CardAnimations?.cardGridStagger?.item}
              className={`bg-white rounded shadow-sm overflow-hidden relative ${!isAvail ? 'opacity-80' : ''}`}
              {...(CardAnimations?.productCardHover || {})}
            >
              <Link
                to={`/detail/${item.id}`}
                className="no-underline text-black"
                onClick={() => onViewContent?.(item)}
              >
                <div className="relative w-48 h-48 mx-auto bg-gray-100 rounded-t">
                  {!isAvail && (
                    <div className="absolute inset-0 bg-black/50 flex items-start justify-end p-2 z-10">
                      <span className="bg-white/90 text-red-600 text-[11px] font-semibold px-2 py-0.5 rounded-full">Indisponible</span>
                    </div>
                  )}
                  {item.promo && (
                    <motion.div
                      className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10"
                      {...(CardAnimations?.promotionBadge || {})}
                    >
                      -{item.promo}%
                    </motion.div>
                  )}
                  {item.covers?.length > 0 ? (
                    <Slider {...(itemSliderSettings || {})}>
                      {item.covers.map((cover, idx) => (
                        <div key={idx}>
                          <motion.img
                            src={cover}
                            alt={`${item.name} ${idx + 1}`}
                            className="w-48 h-48 object-cover"
                            {...(CardAnimations?.productImageHover || {})}
                          />
                        </div>
                      ))}
                    </Slider>
                  ) : (
                    <motion.img
                      src="/img/default.png"
                      alt={item.name}
                      className="w-48 h-48 object-cover"
                      {...(CardAnimations?.productImageHover || {})}
                    />
                  )}
                </div>
                <div className="p-3">
                  <h6 className="font-medium">{item.name}</h6>
                  {item.priceType === 'sizes' ? (
                    Object.keys(item.sizes || {}).length > 0 ? (
                      <p className="text-green-600 text-sm">
                        {Object.entries(item.sizes).map(([size, price], i, arr) => (
                          <span key={size}>
                            {size}: {convertPrice(price).toLocaleString()} Fcfa
                            {i !== arr.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-red-600 text-sm">Aucune taille disponible</p>
                    )
                  ) : (
                    <motion.h6 className="text-green-600 transition-all duration-200" {...(CardAnimations?.priceAnimation || {})}>
                      {convertPrice(item.price).toLocaleString()} Fcfa
                    </motion.h6>
                  )}
                </div>
              </Link>
              <motion.button
                onClick={(e) => isAvail && onAddClick?.(item, e)}
                disabled={!isAvail}
                className={`px-2 py-1 rounded-full text-sm absolute bottom-2 right-2 transition-colors duration-200 ${
                  isAvail ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                }`}
                {...(CardAnimations?.addToCartButton || {})}
                aria-label={`Ajouter ${item.name} au panier avec options`}
              >
                +
              </motion.button>
            </motion.div>
              );
            })}
        </motion.div>
      )}
    </motion.section>
  );
};

export default ProductsGrid;
