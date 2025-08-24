import { useState, useMemo, useCallback } from 'react';

// Default available promos (could be fetched from backend later)
const DEFAULT_PROMOS = [
  {
    code: 'POPULAR50',
    name: 'Offre Spéciale -50%',
    description: 'Sur tous les plats populaires',
    discount: 0.5,
    minTotal: 5000,
    validUntil: '2025-12-31',
    icon: 'Fire',
    color: 'from-red-500 to-pink-500'
  },
  {
    code: 'FREESHIP',
    name: 'Livraison Gratuite',
    description: 'Commande minimum 8000 FCFA',
    freeShipping: true,
    minTotal: 8000,
    validUntil: '2025-12-25',
    icon: 'Gift',
    color: 'from-green-500 to-emerald-500'
  },
  {
    code: 'FAMILY30',
    name: 'Menu Famille -30%',
    description: 'Parfait pour 4-6 personnes',
    discount: 0.3,
    minTotal: 10000,
    validUntil: '2025-12-28',
    icon: 'Sparkles',
    color: 'from-purple-500 to-indigo-500'
  },
  {
    code: 'FLASH40',
    name: 'Flash Sale -40%',
    description: "Seulement aujourd'hui",
    discount: 0.4,
    minTotal: 3000,
    validUntil: '2025-12-20',
    icon: 'Zap',
    color: 'from-orange-500 to-red-500'
  }
];

// Map icon names to lucide-react components at call site
export function resolveIconComponent(name, icons) {
  return icons[name] || icons.Gift;
}

export function useCartPromotions(cartTotal, options = {}) {
  const { onPromoApplied, availablePromos: externalPromos } = options;
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');

  const availablePromos = useMemo(() => externalPromos || DEFAULT_PROMOS, [externalPromos]);

  const isEligible = useCallback((promo) => {
    return Number(cartTotal || 0) >= Number(promo.minTotal || 0);
  }, [cartTotal]);

  const calculateDiscount = useCallback((promo) => {
    if (!promo) return 0;
    if (promo.discount) return Number(cartTotal || 0) * Number(promo.discount);
    return 0;
  }, [cartTotal]);

  const applyPromo = useCallback((code) => {
    const promo = availablePromos.find(p => p.code === String(code || '').toUpperCase());
    if (!promo) return { ok: false, reason: 'invalid' };
    if (!isEligible(promo)) return { ok: false, reason: 'min_total' };
    setAppliedPromo(promo);
    setShowPromoInput(false);
    setPromoCode('');
    const discount = calculateDiscount(promo);
    onPromoApplied && onPromoApplied(promo, discount);
    return { ok: true, promo, discount };
  }, [availablePromos, isEligible, calculateDiscount, onPromoApplied]);

  const removePromo = useCallback(() => {
    setAppliedPromo(null);
    onPromoApplied && onPromoApplied(null, 0);
  }, [onPromoApplied]);

  const discount = useMemo(() => calculateDiscount(appliedPromo), [appliedPromo, calculateDiscount]);

  return {
    state: {
      appliedPromo,
      showPromoInput,
      promoCode,
      availablePromos,
      discount,
    },
    actions: {
      setShowPromoInput,
      setPromoCode,
      applyPromo,
      removePromo,
    },
    helpers: {
      isEligible,
    }
  };
}
