import React, { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import { FaSave, FaTimes, FaGift } from 'react-icons/fa';
import { toast } from 'react-toastify';

const PROMOTION_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount',
  BUY_ONE_GET_ONE: 'bogo',
  FREE_DELIVERY: 'free_delivery',
  MINIMUM_ORDER: 'minimum_order',
};

const PROMOTION_TYPE_LABELS = {
  [PROMOTION_TYPES.PERCENTAGE]: 'Pourcentage de réduction',
  [PROMOTION_TYPES.FIXED_AMOUNT]: 'Montant fixe',
  [PROMOTION_TYPES.BUY_ONE_GET_ONE]: 'Achetez 1, obtenez 1',
  [PROMOTION_TYPES.FREE_DELIVERY]: 'Livraison gratuite',
  [PROMOTION_TYPES.MINIMUM_ORDER]: 'Commande minimum',
};

const PromotionForm = memo(({ promotion, onSave, onCancel, restaurantId }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: PROMOTION_TYPES.PERCENTAGE,
    value: '',
    code: '',
    startDate: '',
    endDate: '',
    isActive: true,
    minimumOrder: '',
    maxUsage: '',
    applicableItems: [],
    ...promotion,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const generatePromoCode = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData((prev) => ({ ...prev, code: result }));
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Le titre est requis';
    if (!formData.description.trim()) newErrors.description = 'La description est requise';
    if (!formData.value || formData.value <= 0) newErrors.value = 'La valeur doit être positive';
    if (!formData.startDate) newErrors.startDate = 'La date de début est requise';
    if (!formData.endDate) newErrors.endDate = 'La date de fin est requise';
    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      newErrors.endDate = 'La date de fin doit être après la date de début';
    }
    if (formData.type === PROMOTION_TYPES.PERCENTAGE && formData.value > 100) {
      newErrors.value = 'Le pourcentage ne peut pas dépasser 100%';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const promotionData = {
        ...formData,
        restaurantId,
        value: Number(formData.value),
        minimumOrder: formData.minimumOrder ? Number(formData.minimumOrder) : null,
        maxUsage: formData.maxUsage ? Number(formData.maxUsage) : null,
        usageCount: promotion?.usageCount || 0,
        startDate: Timestamp.fromDate(new Date(formData.startDate)),
        endDate: Timestamp.fromDate(new Date(formData.endDate)),
        createdAt: promotion?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await onSave(promotionData);
      toast.success(promotion ? 'Promotion mise à jour' : 'Promotion créée avec succès');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la promotion:', error);
      toast.error('Erreur lors de la sauvegarde de la promotion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {promotion ? 'Modifier la promotion' : 'Nouvelle promotion'}
            </h2>
            <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
              <FaTimes size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la promotion *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Ex: Réduction de 20%"
                />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de promotion *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(PROMOTION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
                rows="3"
                placeholder="Décrivez votre promotion..."
              />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valeur * {formData.type === PROMOTION_TYPES.PERCENTAGE && ' (%)'}
                  {formData.type === PROMOTION_TYPES.FIXED_AMOUNT && ' (FCFA)'}
                </label>
                <input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.value ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder={formData.type === PROMOTION_TYPES.PERCENTAGE ? '20' : '5000'}
                  min="0"
                  max={formData.type === PROMOTION_TYPES.PERCENTAGE ? '100' : undefined}
                />
                {errors.value && <p className="text-red-500 text-xs mt-1">{errors.value}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code promo</label>
                <div className="flex">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="PROMO2024"
                  />
                  <button type="button" onClick={generatePromoCode} className="px-4 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600" title="Générer un code">
                    <FaGift />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.startDate ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin *</label>
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${errors.endDate ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commande minimum (FCFA)</label>
                <input
                  type="number"
                  value={formData.minimumOrder}
                  onChange={(e) => setFormData((prev) => ({ ...prev, minimumOrder: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="10000"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Utilisation maximum</label>
                <input
                  type="number"
                  value={formData.maxUsage}
                  onChange={(e) => setFormData((prev) => ({ ...prev, maxUsage: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="100"
                  min="1"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Activer immédiatement cette promotion
              </label>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50" disabled={loading}>
                Annuler
              </button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2" disabled={loading}>
                <FaSave />
                <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
});

export default PromotionForm;
