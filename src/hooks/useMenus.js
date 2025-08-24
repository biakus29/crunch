// src/hooks/useMenus.js
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

function applyPromotionsToItems(items, promotions) {
  const now = new Date();
  const activePromotions = promotions.filter((promo) => {
    if (!promo.isActive) return false;
    const startDate = promo.startDate?.toDate ? promo.startDate.toDate() : new Date(promo.startDate);
    const endDate = promo.endDate?.toDate ? promo.endDate.toDate() : new Date(promo.endDate);
    return now >= startDate && now <= endDate;
  });

  return items.map((item) => {
    const applicablePromo = activePromotions.find((promo) => {
      if (promo.applicableItems && promo.applicableItems.includes(item.id)) return true;
      if (promo.applicableCategories && promo.applicableCategories.includes(item.categoryId)) return true;
      if (promo.type === 'general' || (!promo.applicableItems && !promo.applicableCategories)) return true;
      return false;
    });

    if (applicablePromo && applicablePromo.discountType === 'percentage') {
      return {
        ...item,
        promo: applicablePromo.discountValue,
        originalPrice: item.price,
        promoId: applicablePromo.id,
      };
    }

    return { ...item, promo: null, originalPrice: null, promoId: null };
  });
}

export default function useMenus() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [promos, setPromos] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState({ categories: true, items: true, promos: true, menus: true });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading({ categories: true, items: true, promos: true, menus: true });
      setError(null);
      const [categoriesSnap, itemsSnap, promosSnap, extraListsSnap, menusSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'items')),
        getDocs(collection(db, 'promotions')),
        getDocs(collection(db, 'extraLists')),
        getDocs(collection(db, 'menus')),
      ]);

      const fetchedItems = itemsSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data(), extraLists: doc.data().extraLists || [] }))
        .filter((item) => {
          if (item.priceType === 'sizes') {
            const isValid = item.sizes && Object.keys(item.sizes).length > 0;
            if (!isValid) console.warn(`Article ${item.id} ignoré : sizes invalide`, item.sizes);
            return isValid;
          }
          return true;
        });

      const fetchedMenus = menusSnap.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || 'Menu sans nom',
        covers: doc.data().covers || [],
        description: doc.data().description || 'Un menu délicieux à découvrir.',
        price: doc.data().price || null,
        restaurantId: doc.data().restaurantId || null,
      }));

      const fetchedPromotions = promosSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const itemsWithPromotions = applyPromotionsToItems(fetchedItems, fetchedPromotions);

      setCategories(categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setItems(itemsWithPromotions);
      setPromos(fetchedPromotions);
      setExtraLists(extraListsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setMenus(fetchedMenus);
      setLoading({ categories: false, items: false, promos: false, menus: false });
    } catch (err) {
      console.error('Erreur de chargement des données:', err);
      setError('Erreur de chargement des données');
      setLoading({ categories: false, items: false, promos: false, menus: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { categories, items, promos, extraLists, menus, loading, error, reload: load };
}
