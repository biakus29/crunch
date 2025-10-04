// Système de gestion des rôles et permissions
export const ROLES = {
  MANAGER: 'manager',           // Gérant - Accès complet
  ACCOUNTANT: 'accountant',     // Comptable - Finances uniquement
  KITCHEN_SUPPLY: 'kitchen_supply', // Responsable Cuisine et Approvisionnement
  ORDER_MANAGER: 'order_manager',   // Gestionnaire des Commandes
  SUPPLY_MANAGER: 'supply_manager',  // Gestionnaire des approvisionnements (existant)
  DELIVERY_MANAGER: 'delivery_manager' // Gestionnaire de Livraison
};

export const ROLE_LABELS = {
  [ROLES.MANAGER]: 'Gérant',
  [ROLES.ACCOUNTANT]: 'Comptable',
  [ROLES.KITCHEN_SUPPLY]: 'Responsable Cuisine et Approvisionnement',
  [ROLES.ORDER_MANAGER]: 'Gestionnaire des Commandes',
  [ROLES.SUPPLY_MANAGER]: 'Gestionnaire des Approvisionnements',
  [ROLES.DELIVERY_MANAGER]: 'Gestionnaire de Livraison'
};

// Définition des sections accessibles par rôle
export const ROLE_PERMISSIONS = {
        [ROLES.MANAGER]: {
          // Sections essentielles pour le gérant - Vue simplifiée
          sections: [
            'dashboard',           // Tableau de bord principal
            'orders',              // Gestion des commandes
            'takeawayOrder',       // Commandes à emporter
            'reports',             // Rapports et statistiques
            'accountingReports',   // Rapports comptables détaillés
            'deliveryOptimized',   // Système de livraison optimisé
            'deliveryDashboard',   // Tableau de bord livraison
            'payments',            // Paiements
            'menus',               // Gestion des menus
            'purchases',           // Achats (listes et budgets)
            'promotions',          // Promotions
            'managers',            // Gestion des utilisateurs
            'userRoles',           // Modification des rôles
            'budgets',             // Gestion des budgets
            'expenseClassification', // Classification des sorties
            'expenseCleanup',      // Nettoyage des dépenses
            'kitchen'              // Gestion de la cuisine
          ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewFinances: true,
    canManageUsers: true,
    canAccessAllRestaurants: true // Seul le gérant peut voir tous les restaurants
  },
  
        [ROLES.ACCOUNTANT]: {
          // Accès limité aux achats, budgets, dépenses de livraison et vue financière des commandes
          sections: [
            'orders', 'purchases', 'deliveryDashboard', 'deliveryExpenses', 'reports', 'accountingReports', 'budgets', 'expenseClassification', 'expenseCleanup', 'kitchen' // Commandes (vue financière), achats, tableau de bord livraison, dépenses livraison, rapports, rapports comptables, budgets, classification, nettoyage, cuisine
          ],
    canCreate: true, // Peut créer des dépenses et budgets
    canEdit: true,   // Peut modifier des dépenses et budgets
    canDelete: false, // Ne peut pas supprimer
    canViewFinances: true,
    canManageUsers: false,
    canAccessAllRestaurants: true, // Accès à tous les restaurants pour les finances
    restrictedViews: {
      orders: ['financial'], // Vue financière uniquement des commandes
      purchases: ['view', 'budget', 'manage'], // Peut voir, voter et gérer les budgets
      reports: ['financial', 'expenses'], // Rapports financiers et de dépenses
      deliveryDashboard: ['financial'], // Tableau de bord financier livraison
      deliveryExpenses: ['all'] // Accès complet aux dépenses de livraison
    }
  },
  
  [ROLES.KITCHEN_SUPPLY]: {
    // Accès aux menus, catégories, et sections d'approvisionnement éclatées
    sections: [
      'menus', 'categories', 'ingredients', 'purchases', 'inventory', 'production', 'supplyReports'
    ],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewFinances: false, // Pas d'accès aux montants
    canManageUsers: false,
    canAccessAllRestaurants: false, // Accès seulement à son restaurant
    restrictedViews: {
      supplyReports: ['ingredients', 'inventory', 'production'] // Pas de rapports financiers
    }
  },
  
  [ROLES.ORDER_MANAGER]: {
    // Accès aux commandes, finances et points de fidélité
    sections: [
      'orders', 'createOrder', 'takeawayOrder', 'payments', 'reports', 'comments', 'loyalty'
    ],
    canCreate: true,
    canEdit: true,
    canDelete: false, // Ne peut pas supprimer les commandes
    canViewFinances: true,
    canManageUsers: false,
    canAccessAllRestaurants: false, // Accès seulement à son restaurant
    restrictedViews: {
      payments: ['orders'], // Seulement paiements liés aux commandes
      reports: ['orders', 'delivery'] // Rapports commandes et livraisons
    }
  },
  
  [ROLES.SUPPLY_MANAGER]: {
    // Système existant - Accès complet aux approvisionnements
    sections: ['supplies'],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewFinances: true, // Pour les budgets d'achats
    canManageUsers: false,
    canAccessAllRestaurants: false // Accès seulement à son restaurant
  },
  
  [ROLES.DELIVERY_MANAGER]: {
    // Gestionnaire de livraison - Gestion complète des livreurs et livraisons
    sections: [
      'orders', 'deliveryOptimized', 'deliveryDashboard', 'deliveryTracking', 'deliverers', 'deliveryShifts', 'deliveryExpenses', 'reports' // Toutes les sections de livraison
    ],
    canCreate: true, // Peut créer des livreurs et enregistrer des dépenses
    canEdit: true,   // Peut modifier les assignations de livraison
    canDelete: false, // Ne peut pas supprimer
    canViewFinances: false, // Pas d'accès aux montants financiers globaux
    canManageUsers: false,
    canAccessAllRestaurants: false, // Accès seulement à son restaurant
    restrictedViews: {
      orders: ['delivery'], // Vue livraison uniquement des commandes
      reports: ['delivery'], // Rapports de livraison uniquement
      deliveryExpenses: ['delivery'] // Dépenses du département livraison uniquement
    }
  }
};

// Vérification des permissions
export const hasPermission = (userRole, section, action = 'view') => {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return false;
  
  // Vérifier l'accès à la section
  if (!permissions.sections.includes(section)) return false;
  
  // Vérifier l'action spécifique
  switch (action) {
    case 'create':
      return permissions.canCreate;
    case 'edit':
      return permissions.canEdit;
    case 'delete':
      return permissions.canDelete;
    case 'viewFinances':
      return permissions.canViewFinances;
    case 'manageUsers':
      return permissions.canManageUsers;
    case 'accessAllRestaurants':
      return permissions.canAccessAllRestaurants;
    default:
      return true; // 'view' par défaut
  }
};

// Vérifier l'accès à une vue spécifique dans une section
export const hasViewAccess = (userRole, section, view) => {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions || !permissions.sections.includes(section)) return false;
  
  const restrictedViews = permissions.restrictedViews?.[section];
  if (!restrictedViews) return true; // Pas de restrictions
  
  return restrictedViews.includes(view);
};

// Filtrer les éléments de menu selon le rôle
export const getMenuItemsForRole = (userRole) => {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return [];
  
  const allMenuItems = [
    { id: "restaurant", label: "Infos Restaurant", icon: "FaCog" },
    { id: "menus", label: "Menus", icon: "FaListAlt" },
    { id: "categories", label: "Catégories", icon: "FaTags" },
    { id: "dashboard", label: "Tableau de Bord", icon: "FaHome" },
    { id: "orders", label: "Commandes", icon: "FaShoppingBag" },
    { id: "createOrder", label: "Créer une commande", icon: "FaPlusCircle" },
    { id: "promotions", label: "Promotions", icon: "FaTags" },
    { id: "supplies", label: "Approvisionnements", icon: "FaBox" },
    { id: "ingredients", label: "Ingrédients", icon: "FaBoxes" },
    { id: "purchases", label: "Achats", icon: "FaShoppingCart" },
    { id: "inventory", label: "Inventaires", icon: "FaClipboardList" },
    { id: "production", label: "Production", icon: "FaCogs" },
    { id: "supplyReports", label: "Rapports Appro", icon: "FaChartLine" },
    { id: "ambassadors", label: "Ambassadeurs", icon: "FaUserTie" },
    { id: "deliveryDashboard", label: "Tableau de Bord Livraison", icon: "FaChartLine" },
    { id: "deliveryTracking", label: "Suivi Livraisons", icon: "FaMapMarkedAlt" },
    { id: "deliverers", label: "Livreurs", icon: "FaTruck" },
    { id: "deliveryShifts", label: "Horaires Livreurs", icon: "FaClock" },
    { id: "deliveryExpenses", label: "Dépenses Livraison", icon: "FaReceipt" },
    { id: "payments", label: "Paiements", icon: "FaMoneyBillWave" },
    { id: "loyalty", label: "Points Fidélité", icon: "FaStar" },
    { id: "comments", label: "Avis Clients", icon: "FaCommentAlt" },
    { id: "reports", label: "Rapports", icon: "FaChartLine" },
    { id: "managers", label: "Gestion des Utilisateurs", icon: "FaUsers" },
    { id: "userRoles", label: "Modifier les Rôles", icon: "FaUserTie" },
    { id: "budgets", label: "Gestion des Budgets", icon: "FaMoneyBillWave" },
        { id: "expenseClassification", label: "Classification des Sorties", icon: "FaChartPie" },
        { id: "expenseCleanup", label: "Nettoyage des Dépenses", icon: "FaBroom" },
        { id: "kitchen", label: "Cuisine", icon: "FaUtensils" },
        { id: "takeawayOrder", label: "Commande à Emporter", icon: "FaShoppingBag" },
        { id: "accountingReports", label: "Rapports Comptables", icon: "FaFileExport" }
  ];
  
  return allMenuItems.filter(item => permissions.sections.includes(item.id));
};

// Obtenir la section par défaut pour la redirection selon le rôle
export const getDefaultSectionForRole = (userRole) => {
  // Interfaces prioritaires par rôle
  const prioritySections = {
    [ROLES.MANAGER]: 'dashboard', // Gérant : Tableau de bord complet
    [ROLES.ACCOUNTANT]: 'accountingReports', // Comptable : Rapports comptables
    [ROLES.KITCHEN_SUPPLY]: 'purchases', // Cuisine : Achats et approvisionnements
    [ROLES.ORDER_MANAGER]: 'orders', // Gestionnaire commandes : Commandes
    [ROLES.SUPPLY_MANAGER]: 'supplies', // Gestionnaire approvisionnements : Approvisionnements
    [ROLES.DELIVERY_MANAGER]: 'deliveryOptimized', // Gestionnaire livraison : Système de livraison optimisé
  };
  
  // Vérifier si le rôle a une section prioritaire définie
  if (prioritySections[userRole]) {
    return prioritySections[userRole];
  }
  
  // Fallback : première section accessible
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions || !permissions.sections.length) return null;
  
  return permissions.sections[0];
};
