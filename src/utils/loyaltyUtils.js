/**
 * Utilitaires pour la gestion des points fidélité et codes promo
 */

// Configuration des taux de conversion
export const LOYALTY_CONFIG = {
  // Conversion points vers réduction
  POINTS_TO_MONEY_RATE: 100, // 100 points = 5€
  MONEY_VALUE_PER_POINTS: 5, // 5€ pour 100 points
  
  // Conversion achat vers points (par défaut)
  DEFAULT_POINTS_PER_EURO: 10, // 1€ dépensé = 10 points
  
  // Limites
  MIN_POINTS_TO_USE: 100, // Minimum de points pour utiliser une réduction
  MAX_POINTS_PER_ORDER: 5000, // Maximum de points utilisables par commande
  
  // Commission ambassadeur
  DEFAULT_AMBASSADOR_COMMISSION: 0.05, // 5% de commission par défaut
  
  // Validité
  DEFAULT_PROMO_VALIDITY_DAYS: 30, // Validité par défaut des codes promo
  POINTS_EXPIRY_DAYS: 365, // Expiration des points après 1 an
};

/**
 * Génère un code promo unique
 * @param {string} ambassadorId - ID de l'ambassadeur
 * @param {string} prefix - Préfixe optionnel
 * @returns {string} Code promo unique
 */
export const generatePromoCode = (ambassadorId, prefix = 'CRUNCH') => {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString(36).substring(-4).toUpperCase();
  return `${prefix}-${randomPart}-${timestamp}`;
};

/**
 * Valide un code promo
 * @param {Object} promoCode - Objet code promo depuis Firestore
 * @returns {Object} {valid: boolean, message: string}
 */
export const validatePromoCode = (promoCode) => {
  if (!promoCode) {
    return { valid: false, message: "Code promo invalide" };
  }

  // Vérifier l'expiration
  if (promoCode.expirationDate) {
    const expDate = promoCode.expirationDate.toDate ? 
      promoCode.expirationDate.toDate() : 
      new Date(promoCode.expirationDate);
    
    if (expDate < new Date()) {
      return { valid: false, message: "Ce code promo a expiré" };
    }
  }

  // Vérifier le nombre d'utilisations
  if (promoCode.maxUses && promoCode.usesCount >= promoCode.maxUses) {
    return { valid: false, message: "Ce code promo a atteint sa limite d'utilisation" };
  }

  // Vérifier si le code est actif
  if (promoCode.active === false) {
    return { valid: false, message: "Ce code promo n'est plus actif" };
  }

  return { valid: true, message: "Code promo valide" };
};

/**
 * Calcule les points gagnés pour un montant
 * @param {number} amount - Montant en FCFA
 * @param {Object} promoCode - Code promo appliqué (optionnel)
 * @returns {number} Points gagnés
 */
export const calculatePointsEarned = (amount, promoCode = null) => {
  let basePoints = Math.floor(amount / 100) * LOYALTY_CONFIG.DEFAULT_POINTS_PER_EURO;
  
  if (promoCode) {
    if (promoCode.bonusPointsRate) {
      // Bonus multiplicateur de points
      basePoints = Math.floor(basePoints * (1 + promoCode.bonusPointsRate));
    }
    if (promoCode.fixedPoints) {
      // Points fixes additionnels
      basePoints += promoCode.fixedPoints;
    }
  }
  
  return basePoints;
};

/**
 * Calcule la réduction en argent pour un nombre de points
 * @param {number} points - Nombre de points à utiliser
 * @returns {number} Réduction en FCFA
 */
export const calculatePointsDiscount = (points) => {
  if (points < LOYALTY_CONFIG.MIN_POINTS_TO_USE) {
    return 0;
  }
  
  const maxPoints = Math.min(points, LOYALTY_CONFIG.MAX_POINTS_PER_ORDER);
  return Math.floor(maxPoints / LOYALTY_CONFIG.POINTS_TO_MONEY_RATE) * 
    LOYALTY_CONFIG.MONEY_VALUE_PER_POINTS * 100; // Conversion en FCFA
};

/**
 * Calcule la commission d'un ambassadeur
 * @param {number} orderAmount - Montant de la commande en FCFA
 * @param {number} commissionRate - Taux de commission (0.05 = 5%)
 * @returns {number} Commission en FCFA
 */
export const calculateAmbassadorCommission = (orderAmount, commissionRate = LOYALTY_CONFIG.DEFAULT_AMBASSADOR_COMMISSION) => {
  return Math.floor(orderAmount * commissionRate);
};

/**
 * Formate l'affichage des points
 * @param {number} points - Nombre de points
 * @returns {string} Points formatés
 */
export const formatPoints = (points) => {
  return new Intl.NumberFormat('fr-FR').format(points) + ' pts';
};

/**
 * Formate la valeur monétaire des points
 * @param {number} points - Nombre de points
 * @returns {string} Valeur formatée
 */
export const formatPointsValue = (points) => {
  const value = calculatePointsDiscount(points);
  return new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';
};

/**
 * Vérifie si un utilisateur peut utiliser ses points
 * @param {number} pointsBalance - Solde de points
 * @param {number} orderAmount - Montant de la commande
 * @returns {Object} {canUse: boolean, maxUsablePoints: number, maxDiscount: number}
 */
export const checkPointsUsability = (pointsBalance, orderAmount) => {
  if (pointsBalance < LOYALTY_CONFIG.MIN_POINTS_TO_USE) {
    return {
      canUse: false,
      maxUsablePoints: 0,
      maxDiscount: 0,
      message: `Minimum ${LOYALTY_CONFIG.MIN_POINTS_TO_USE} points requis`
    };
  }

  const maxUsablePoints = Math.min(pointsBalance, LOYALTY_CONFIG.MAX_POINTS_PER_ORDER);
  const maxDiscount = calculatePointsDiscount(maxUsablePoints);
  
  // Ne pas permettre une réduction supérieure à 50% du montant
  const maxAllowedDiscount = Math.floor(orderAmount * 0.5);
  
  if (maxDiscount > maxAllowedDiscount) {
    const adjustedPoints = Math.floor(maxAllowedDiscount / LOYALTY_CONFIG.MONEY_VALUE_PER_POINTS / 100) * LOYALTY_CONFIG.POINTS_TO_MONEY_RATE;
    return {
      canUse: true,
      maxUsablePoints: adjustedPoints,
      maxDiscount: calculatePointsDiscount(adjustedPoints),
      message: "Réduction limitée à 50% du montant"
    };
  }

  return {
    canUse: true,
    maxUsablePoints,
    maxDiscount,
    message: null
  };
};

/**
 * Génère un historique de transaction de points
 * @param {string} type - Type de transaction ('earned', 'used', 'expired', 'bonus')
 * @param {number} points - Nombre de points
 * @param {Object} metadata - Métadonnées additionnelles
 * @returns {Object} Objet transaction
 */
export const createPointsTransaction = (type, points, metadata = {}) => {
  return {
    type,
    points,
    timestamp: new Date(),
    ...metadata
  };
};

/**
 * Calcule les statistiques d'un ambassadeur
 * @param {Array} orders - Liste des commandes avec le code promo
 * @param {Object} promoCode - Code promo de l'ambassadeur
 * @returns {Object} Statistiques
 */
export const calculateAmbassadorStats = (orders, promoCode) => {
  const stats = {
    totalOrders: orders.length,
    totalRevenue: 0,
    totalPoints: 0,
    totalCommission: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    topCustomers: [],
    dailyStats: {},
    weeklyStats: {},
    monthlyStats: {}
  };

  orders.forEach(order => {
    const orderTotal = order.total || 0;
    const pointsEarned = order.pointsEarned || 0;
    const commission = calculateAmbassadorCommission(orderTotal, promoCode.commissionRate);
    
    stats.totalRevenue += orderTotal;
    stats.totalPoints += pointsEarned;
    stats.totalCommission += commission;

    // Statistiques par période
    const orderDate = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
    const dayKey = orderDate.toISOString().split('T')[0];
    const weekKey = getWeekKey(orderDate);
    const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;

    // Daily stats
    if (!stats.dailyStats[dayKey]) {
      stats.dailyStats[dayKey] = { orders: 0, revenue: 0, points: 0 };
    }
    stats.dailyStats[dayKey].orders++;
    stats.dailyStats[dayKey].revenue += orderTotal;
    stats.dailyStats[dayKey].points += pointsEarned;

    // Weekly stats
    if (!stats.weeklyStats[weekKey]) {
      stats.weeklyStats[weekKey] = { orders: 0, revenue: 0, points: 0 };
    }
    stats.weeklyStats[weekKey].orders++;
    stats.weeklyStats[weekKey].revenue += orderTotal;
    stats.weeklyStats[weekKey].points += pointsEarned;

    // Monthly stats
    if (!stats.monthlyStats[monthKey]) {
      stats.monthlyStats[monthKey] = { orders: 0, revenue: 0, points: 0 };
    }
    stats.monthlyStats[monthKey].orders++;
    stats.monthlyStats[monthKey].revenue += orderTotal;
    stats.monthlyStats[monthKey].points += pointsEarned;
  });

  stats.averageOrderValue = stats.totalOrders > 0 ? 
    Math.floor(stats.totalRevenue / stats.totalOrders) : 0;

  return stats;
};

/**
 * Obtient la clé de semaine pour une date
 * @param {Date} date - Date
 * @returns {string} Clé de semaine (YYYY-WW)
 */
const getWeekKey = (date) => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

/**
 * Exporte les statistiques en CSV
 * @param {Object} stats - Statistiques à exporter
 * @param {string} filename - Nom du fichier
 */
export const exportStatsToCSV = (stats, filename = 'ambassador-stats.csv') => {
  const rows = [
    ['Métrique', 'Valeur'],
    ['Total Commandes', stats.totalOrders],
    ['Chiffre d\'affaires total', stats.totalRevenue + ' FCFA'],
    ['Points distribués', stats.totalPoints],
    ['Commission totale', stats.totalCommission + ' FCFA'],
    ['Panier moyen', stats.averageOrderValue + ' FCFA'],
    ['', ''],
    ['Statistiques journalières', ''],
    ['Date', 'Commandes', 'Revenus', 'Points']
  ];

  Object.entries(stats.dailyStats).forEach(([date, data]) => {
    rows.push([date, data.orders, data.revenue + ' FCFA', data.points]);
  });

  const csvContent = rows.map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
