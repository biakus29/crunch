import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  getPromotionsByRestaurant,
  createPromotion,
  updatePromotion,
  deletePromotionById,
  setPromotionStatus,
} from '../../services';

export default function usePromotionsAdmin(restaurantId) {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [filter, setFilter] = useState('all'); // all, active, inactive, expired

  const loadPromotions = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const data = await getPromotionsByRestaurant(restaurantId);
      setPromotions(data);
    } catch (error) {
      console.error('Erreur lors du chargement des promotions:', error);
      toast.error('Erreur lors du chargement des promotions');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  const handleSavePromotion = useCallback(
    async (promotionData) => {
      try {
        if (editingPromotion) {
          await updatePromotion(editingPromotion.id, promotionData);
          toast.success('Promotion mise à jour avec succès!');
        } else {
          await createPromotion(promotionData);
          toast.success('Promotion créée avec succès!');
        }
        await loadPromotions();
        setShowForm(false);
        setEditingPromotion(null);
      } catch (error) {
        console.error('Erreur sauvegarde promotion:', error);
        throw error;
      }
    },
    [editingPromotion, loadPromotions]
  );

  const handleDeletePromotion = useCallback(async (promotionId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette promotion ?')) return;
    try {
      await deletePromotionById(promotionId);
      await loadPromotions();
      toast.success('Promotion supprimée avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression de la promotion');
    }
  }, [loadPromotions]);

  const handleToggleStatus = useCallback(async (promotionId, isActive) => {
    try {
      await setPromotionStatus(promotionId, isActive);
      await loadPromotions();
      toast.success(`Promotion ${isActive ? 'activée' : 'désactivée'}`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  }, [loadPromotions]);

  const filteredPromotions = useMemo(() => {
    const now = new Date();
    return promotions.filter((promotion) => {
      const startDate = new Date(promotion.startDate);
      const endDate = new Date(promotion.endDate);
      switch (filter) {
        case 'active':
          return promotion.isActive && now >= startDate && now <= endDate;
        case 'inactive':
          return !promotion.isActive;
        case 'expired':
          return now > endDate;
        default:
          return true;
      }
    });
  }, [promotions, filter]);

  return {
    state: {
      promotions,
      loading,
      showForm,
      editingPromotion,
      filter,
      filteredPromotions,
    },
    actions: {
      setFilter,
      setShowForm,
      setEditingPromotion,
      loadPromotions,
      handleSavePromotion,
      handleDeletePromotion,
      handleToggleStatus,
    },
  };
}
