import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTags, FaEdit, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa';

const PROMOTION_COLORS = {
  percentage: 'bg-blue-500',
  fixed_amount: 'bg-green-500',
  bogo: 'bg-purple-500',
  free_delivery: 'bg-orange-500',
  minimum_order: 'bg-red-500',
};

const PROMOTION_TYPE_LABELS = {
  percentage: 'Pourcentage de réduction',
  fixed_amount: 'Montant fixe',
  bogo: 'Achetez 1, obtenez 1',
  free_delivery: 'Livraison gratuite',
  minimum_order: 'Commande minimum',
};

const PromotionCard = ({ promotion, onEdit, onDelete, onToggleStatus }) => {
  const isActive =
    promotion.isActive &&
    new Date() >= new Date(promotion.startDate) &&
    new Date() <= new Date(promotion.endDate);
  const isExpired = new Date() > new Date(promotion.endDate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-white rounded-lg shadow-md border-l-4 ${PROMOTION_COLORS[promotion.type]} p-4 hover:shadow-lg transition-shadow`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-2">
          <FaTags className={`text-white p-1 rounded ${PROMOTION_COLORS[promotion.type]} text-lg`} />
          <h3 className="font-semibold text-gray-800">{promotion.title}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onToggleStatus(promotion.id, !promotion.isActive)}
            className={`p-1 rounded ${isActive ? 'text-green-600' : 'text-gray-400'}`}
            title={promotion.isActive ? 'Désactiver' : 'Activer'}
          >
            {promotion.isActive ? <FaToggleOn size={20} /> : <FaToggleOff size={20} />}
          </button>
          <button onClick={() => onEdit(promotion)} className="text-blue-600 hover:text-blue-800 p-1" title="Modifier">
            <FaEdit />
          </button>
          <button onClick={() => onDelete(promotion.id)} className="text-red-600 hover:text-red-800 p-1" title="Supprimer">
            <FaTrash />
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <p className="text-gray-600">{promotion.description}</p>

        <div className="flex items-center space-x-4">
          <span className="font-medium text-gray-700">{PROMOTION_TYPE_LABELS[promotion.type]}</span>
          {promotion.type === 'percentage' && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">-{promotion.value}%</span>
          )}
          {promotion.type === 'fixed_amount' && (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">-{promotion.value} FCFA</span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Du {new Date(promotion.startDate).toLocaleDateString('fr-FR')}</span>
          <span>Au {new Date(promotion.endDate).toLocaleDateString('fr-FR')}</span>
        </div>

        {promotion.code && (
          <div className="bg-gray-100 p-2 rounded text-center">
            <span className="font-mono text-sm font-bold">Code: {promotion.code}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              isExpired
                ? 'bg-red-100 text-red-800'
                : isActive
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {isExpired ? 'Expirée' : isActive ? 'Active' : 'Inactive'}
          </span>

          {promotion.usageCount !== undefined && (
            <span className="text-xs text-gray-500">Utilisée {promotion.usageCount || 0} fois</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const PromotionList = ({ promotions, onEdit, onDelete, onToggleStatus }) => {
  if (!promotions || promotions.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnimatePresence>
        {promotions.map((promotion) => (
          <PromotionCard
            key={promotion.id}
            promotion={promotion}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleStatus={onToggleStatus}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default PromotionList;
