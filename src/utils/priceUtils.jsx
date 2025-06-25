// src/utils/priceUtils.js
export const formatPrice = (price) => {
  return Number(price).toLocaleString("fr-FR", { style: "currency", currency: "XAF" });
};

export const convertPrice = (price) => {
  return Number(price);
};