// src/features/cart/utils/pricing.js
// Calcule le prix total d'un item avec tailles, extras et quantité

export function normalizePrice(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return parseFloat(value.replace(/\./g, '')) || 0;
  return Number(value) || 0;
}

export function computeBasePrice(item, selectedSizeKey) {
  if (!item) return 0;
  if (item.priceType === 'sizes' && item.sizes && selectedSizeKey) {
    const sizePrice = item.sizes[selectedSizeKey];
    return normalizePrice(sizePrice);
  }
  return normalizePrice(item.price);
}

export function computeExtrasPrice(selectedExtras = []) {
  return selectedExtras.reduce((sum, ex) => sum + normalizePrice(ex.price), 0);
}

export function computeTotal({ item, quantity = 1, selectedSizeKey, selectedExtras }) {
  const base = computeBasePrice(item, selectedSizeKey);
  const extras = computeExtrasPrice(selectedExtras);
  const total = (base + extras) * Math.max(1, quantity);
  return Math.max(0, Math.round(total));
}

export default {
  normalizePrice,
  computeBasePrice,
  computeExtrasPrice,
  computeTotal,
};
