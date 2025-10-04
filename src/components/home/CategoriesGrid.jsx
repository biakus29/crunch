import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const CategoriesGrid = ({ categories = [], loading = false, scrollAnimation, CardAnimations }) => {
  return (
    <motion.section 
      {...(scrollAnimation || {})}
      className="p-3"
    >
      <motion.h6 
        className="mb-2 font-medium"
      >
        Que recherchez-vous ?
      </motion.h6>
      {loading ? (
        <div className="flex items-center justify-center py-6">Chargement...</div>
      ) : (
        <motion.div 
          className="grid grid-cols-4 gap-2"
          variants={CardAnimations?.cardGridStagger?.container}
          initial="initial"
          animate="animate"
        >
          {categories.map((category) => (
            <motion.div
              key={category.id}
              variants={CardAnimations?.cardGridStagger?.item}
              className="bg-white shadow-sm rounded text-center p-2"
              {...(CardAnimations?.categoryCardHover || {})}
            >
              <Link to={`/categories/${category.id}`}>
                <motion.img 
                  src={category.icon} 
                  alt={category.name} 
                  className="w-10 h-10 mx-auto"
                  {...(CardAnimations?.productImageHover || {})}
                />
                <p className="mt-2 text-sm text-gray-600">{category.name}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.section>
  );
};

export default CategoriesGrid;
