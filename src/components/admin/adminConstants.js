// Admin constants centralized for reuse across admin components

export const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  READY_TO_DELIVER: "pret_a_livrer",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  FAILED: "echec",
};

export const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "En attente",
  [ORDER_STATUS.PREPARING]: "En préparation",
  [ORDER_STATUS.READY_TO_DELIVER]: "Prêt à livrer",
  [ORDER_STATUS.DELIVERING]: "En livraison",
  [ORDER_STATUS.DELIVERED]: "Livrée",
  [ORDER_STATUS.FAILED]: "Échec",
};

export const STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-yellow-500 text-white",
  [ORDER_STATUS.PREPARING]: "bg-blue-500 text-white",
  [ORDER_STATUS.READY_TO_DELIVER]: "bg-purple-500 text-white",
  [ORDER_STATUS.DELIVERING]: "bg-orange-500 text-white",
  [ORDER_STATUS.DELIVERED]: "bg-green-600 text-white",
  [ORDER_STATUS.FAILED]: "bg-red-600 text-white",
};

export const STATUS_COLUMN_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-gray-100 border-gray-300",
  [ORDER_STATUS.PREPARING]: "bg-blue-50 border-blue-200",
  [ORDER_STATUS.READY_TO_DELIVER]: "bg-purple-50 border-purple-200",
  [ORDER_STATUS.DELIVERING]: "bg-yellow-50 border-yellow-200",
  [ORDER_STATUS.DELIVERED]: "bg-green-50 border-green-200",
};

export const DEFAULT_DELIVERY_FEE = 1000;

export const FAILURE_REASONS = [
  "Client injoignable",
  "Adresse incorrecte",
  "Annulation par le client",
  "Problème de stock",
  "Erreur de livraison",
  "Autre",
];
