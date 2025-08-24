import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTags } from 'react-icons/fa';
import usePromotionsAdmin from '../../hooks/admin/usePromotionsAdmin';
import PromotionFilters from './PromotionFilters';
import PromotionList from './PromotionList';
import PromotionForm from './PromotionForm';

// Composant principal
const PromotionManager = ({ restaurantId }) => {
  const { state, actions } = usePromotionsAdmin(restaurantId);
  const {
    promotions,
    loading,
    showForm,
    editingPromotion,
    filter,
    filteredPromotions,
  } = state;
  const {
    setFilter,
    setShowForm,
    setEditingPromotion,
    handleSavePromotion,
    handleDeletePromotion,
    handleToggleStatus,
  } = actions;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtres et action création */}
      <PromotionFilters
        filter={filter}
        onChange={setFilter}
        count={filteredPromotions.length}
        onCreate={() => setShowForm(true)}
      />

      {/* Liste des promotions */}
      {filteredPromotions.length === 0 ? (
        <div className="text-center py-12">
          <FaTags className="mx-auto text-gray-400 text-4xl mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune promotion</h3>
          <p className="text-gray-500 mb-4">
            {filter === 'all' 
              ? 'Vous n\'avez pas encore créé de promotions.'
              : `Aucune promotion ${filter === 'active' ? 'active' : filter === 'inactive' ? 'inactive' : 'expirée'}.`
            }
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Créer ma première promotion
          </button>
        </div>
      ) : (
        <PromotionList
          promotions={filteredPromotions}
          onEdit={(promo) => {
            setEditingPromotion(promo);
            setShowForm(true);
          }}
          onDelete={handleDeletePromotion}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {/* Formulaire de création/édition */}
      <AnimatePresence>
        {showForm && (
          <PromotionForm
            promotion={editingPromotion}
            onSave={handleSavePromotion}
            onCancel={() => {
              setShowForm(false);
              setEditingPromotion(null);
            }}
            restaurantId={restaurantId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(PromotionManager);