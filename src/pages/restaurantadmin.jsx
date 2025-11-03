import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useNavigate } from "react-router-dom";

import { db, auth, storage } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  onSnapshot,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { FaHome, FaCog, FaListAlt, FaTags, FaShoppingBag, FaPlusCircle, FaBox, FaBoxes, FaShoppingCart, FaChartLine, FaUserTie, FaMapMarkedAlt, FaTruck, FaClock, FaReceipt, FaMoneyBillWave, FaStar, FaCommentAlt, FaFileExport, FaUsers, FaChartPie, FaBroom, FaUtensils, FaWallet, FaCode, FaHistory, FaCogs, FaHandshake } from 'react-icons/fa';
import { HiOutlineLogout } from "react-icons/hi";
import LoyaltyPointsManager from "./LoyaltyPoints";
import CreateOrderForm from "./CreateOrderForm";
import PendingOrdersModal from "../components/admin/orders/PendingOrdersModal";
import SalesHistory from "../components/SalesHistory";
import AdminHeader from "../components/admin/AdminHeader";
import OrderCard from "../components/admin/orders/OrderCard";
import OrderDetailsModal from "../components/admin/orders/OrderDetailsModal";
import Sidebar from "../components/admin/Layout/Sidebar";
import Topbar from "../components/admin/Layout/Topbar";
import { useOrdersAdmin } from "../features/orders/useOrdersAdmin";
import {
  ORDER_STATUS,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_COLUMN_COLORS,
  DEFAULT_DELIVERY_FEE,
  FAILURE_REASONS,
} from "../components/admin/adminConstants";
import {
  formatPrice,
  convertPrice,
  calculateTimeDifferenceInMinutes,
  calculateOrderTotals,
  getWeekNumber,
} from "../utils/adminUtils";

const PromotionManager = React.lazy(() => import("../components/admin/PromotionManager"));
const AllPaymentsPage = React.lazy(() => import("../components/admin/AllPaymentsPage"));
const AmbassadorManager = React.lazy(() => import("../components/admin/AmbassadorManager"));
const SupplyManager = React.lazy(() => import("../components/admin/SupplyManager"));
const IngredientsManager = React.lazy(() => import("../components/admin/IngredientsManager"));
const PurchasesManager = React.lazy(() => import("../components/admin/PurchasesManager"));
const SupplyReports = React.lazy(() => import("../components/admin/SupplyReports"));
const DeliveryManager = React.lazy(() => import("../components/admin/DeliveryManager"));
const DeliveryShiftManager = React.lazy(() => import("../components/admin/DeliveryShiftManager"));
const DeliveryExpensesManager = React.lazy(() => import("../components/admin/DeliveryExpensesManager"));
const DeliveryFinancialDashboard = React.lazy(() => import("../components/admin/DeliveryFinancialDashboard"));
const DeliveryTracking = React.lazy(() => import("../components/admin/DeliveryTracking"));
const ManagerDashboard = React.lazy(() => import("../components/admin/ManagerDashboard"));
const ManagerExpenseTracker = React.lazy(() => import("../components/admin/ManagerExpenseTracker"));
const ExpenseDeletionApproval = React.lazy(() => import("../components/admin/ExpenseDeletionApproval"));
const TakeawayOrderForm = React.lazy(() => import("../components/admin/TakeawayOrderForm"));
const BudgetManager = React.lazy(() => import("../components/admin/BudgetManager"));
const NewAccountingInterface = React.lazy(() => import("../components/admin/NewAccountingInterface"));
const ExpenseClassificationSystem = React.lazy(() => import("../components/admin/ExpenseClassificationSystem"));
const ExpenseCleanupManager = React.lazy(() => import("../components/admin/ExpenseCleanupManager"));
const SimpleKitchenManager = React.lazy(() => import("../components/admin/SimpleKitchenManager"));
const DeveloperInterface = React.lazy(() => import("../components/admin/DeveloperInterface"));
const AccountingReports = React.lazy(() => import("../components/admin/AccountingReports"));
import UserInterfacesViewer from "../components/admin/UserInterfacesViewer";
// Remplacement de l'ancien outil de migration par un tableau d'historique
import OrdersHistoryTable from "../components/admin/OrdersHistoryTable";
const AccountAdjustmentManager = React.lazy(() => import("../components/admin/AccountAdjustmentManager"));
import OrdersToolbar from "../components/admin/OrdersToolbar";
import CommentsSection from "../components/admin/CommentsSection";
import ReportsDashboard from "../components/admin/ReportsDashboard";
import FinancialOrdersView from "../components/admin/FinancialOrdersView";
import { useRoleAuth } from "../hooks/useRoleAuth";
import { ROLES, ROLE_LABELS, getMenuItemsForRole, hasPermission, hasViewAccess } from "../utils/rolePermissions";
import RoleBasedUserManager from "../components/admin/RoleBasedUserManager";
import RoleProtectedRoute, { AccessDeniedMessage } from "../components/auth/RoleProtectedRoute";
import RolePriorityIndicator from "../components/admin/RolePriorityIndicator";
import PurchaseSummary from '../components/PurchaseSummary';

const RestaurantAdmin = () => {
  // Hook d'authentification basée sur les rôles
  const { userRole, canAccess, getDefaultSection, isManager, restaurantId: userRestaurantId, canAccessAllRestaurants, user } = useRoleAuth();
  const navigate = useNavigate();
  
  const [restaurant, setRestaurant] = useState(null);
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    adresse: "",
    city: "",
    location: "",
    contact: "",
  });

  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  // Les commandes sont maintenant gérées par useOrdersAdmin
  const [extraLists, setExtraLists] = useState([]);
  const [usersData, setUsersData] = useState({ byId: {}, byPhone: {} });
  const [deliveryFees, setDeliveryFees] = useState({});
  const [deliverers, setDeliverers] = useState([]);
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [viewMode, setViewMode] = useState("kanban");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Utiliser le restaurant de l'utilisateur connecté
  // Pour le comptable, on ne filtre pas par restaurant (accès à tous les restaurants)
  const currentRestaurantId = canAccessAllRestaurants() ? null : userRestaurantId;
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateFilterMode, setDateFilterMode] = useState('day');
  const [editingMenu, setEditingMenu] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [menuData, setMenuData] = useState({ 
    name: "", 
    covers: [], 
    coverPreviews: [] 
  });
  const [categoryData, setCategoryData] = useState({
    name: "",
    description: "",
    icon: "",
    iconFile: null,
    iconPreview: "",
  });
  const [itemData, setItemData] = useState({
    name: "",
    description: "",
    priceType: "single",
    price: "",
    sizes: { L: "", XL: "" },
    saleMode: "pack",
    categoryId: "",
    available: true,
    scheduledDay: [],
    needAssortement: false,
    assortments: [],
    extraLists: [],
    quantityleft: 0,
    covers: [],
    coverPreviews: [],
    menuId: "",
  });
  const [editingItem, setEditingItem] = useState(null);
  const [extraListData, setExtraListData] = useState({
    name: "",
    extraListElements: [{ name: "", price: "", required: false, multiple: false }],
  });
  const [editingExtraList, setEditingExtraList] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(() => {
    // Définir la section par défaut selon le rôle
    return getDefaultSection() || "orders";
  });
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [activeMenuSubSection, setActiveMenuSubSection] = useState("menus");
  const [activeOrderSubSection, setActiveOrderSubSection] = useState("list");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [showTakeawayModal, setShowTakeawayModal] = useState(false);
  const API_URL = process.env.REACT_APP_API_URL || "https://crunchpay.seed-apps.com";


// Définition complète des éléments de menu avec icônes
const allMenuItems = [
  { id: "dashboard", label: "Tableau de Bord", icon: <FaHome /> },
  { id: "restaurant", label: "Infos Restaurant", icon: <FaCog /> },
  { id: "menus", label: "Menus", icon: <FaListAlt /> },
  { id: "categories", label: "Catégories", icon: <FaTags /> },
  { id: "orders", label: "Commandes", icon: <FaShoppingBag /> },
  { id: "createOrder", label: "Créer une commande", icon: <FaPlusCircle /> },
  { id: "takeawayOrder", label: "Commande à Emporter", icon: <FaShoppingBag /> },
  { id: "promotions", label: "Promotions", icon: <FaTags /> },
  { id: "supplies", label: "Approvisionnements", icon: <FaBox /> },
  { id: "ingredients", label: "Ingrédients", icon: <FaBoxes /> },
  { id: "purchases", label: "Achats", icon: <FaShoppingCart /> },
  { id: "supplyReports", label: "Rapports Appro", icon: <FaChartLine /> },
  { id: "ambassadors", label: "Ambassadeurs", icon: <FaUserTie /> },
  { id: "deliveryDashboard", label: "Tableau de Bord Livraison", icon: <FaChartLine /> },
  { id: "deliveryTracking", label: "Suivi Livraisons", icon: <FaMapMarkedAlt /> },
  { id: "deliverers", label: "Livreurs", icon: <FaTruck /> },
  { id: "deliveryShifts", label: "Horaires Livreurs", icon: <FaClock /> },
  { id: "deliveryExpenses", label: "Dépenses Livraison", icon: <FaReceipt /> },
  { id: "partnerDashboard", label: "Dashboard Partenaires", icon: <FaHandshake /> },
  { id: "payments", label: "Paiements", icon: <FaMoneyBillWave /> },
  { id: "loyalty", label: "Points Fidélité", icon: <FaStar /> },
  { id: "comments", label: "Avis Clients", icon: <FaCommentAlt /> },
  { id: "reports", label: "Rapports", icon: <FaChartLine /> },
  { id: "accountingReports", label: "Rapports Comptables", icon: <FaFileExport /> },
  { id: "accountingCenter", label: "Centre Comptable", icon: <FaMoneyBillWave /> },
  { id: "managers", label: "Gestion des Utilisateurs", icon: <FaUsers /> },
  { id: "budgets", label: "Gestion des Budgets", icon: <FaMoneyBillWave /> },
  { id: "expenseClassification", label: "Classification des Sorties", icon: <FaChartPie /> },
  { id: "expenseCleanup", label: "Nettoyage des Dépenses", icon: <FaBroom /> },
  { id: "kitchen", label: "Cuisine", icon: <FaUtensils /> },
  { id: "accountAdjustment", label: "État des Caisses", icon: <FaWallet /> },
  { id: "developer", label: "Interface Développeur", icon: <FaCode /> },
  { id: "historiqueCommandes", label: "Historique Commandes", icon: <FaHistory /> },
];

// Structure universelle de la sidebar organisée en 6 sections pour tous les utilisateurs
const universalMenuSections = [
  {
    title: "📋 Gestion des Commandes",
    items: [
      { id: "dashboard", label: "Tableau de Bord", icon: <FaHome /> },
      { id: "orders", label: "Commandes", icon: <FaShoppingBag /> },
      { id: "createOrder", label: "Créer une commande", icon: <FaPlusCircle /> },
      { id: "takeawayOrder", label: "Commande à Emporter", icon: <FaShoppingBag /> },
      { id: "historiqueCommandes", label: "Historique Commandes", icon: <FaHistory /> },
      { id: "menus", label: "Menus", icon: <FaListAlt /> },
      { id: "categories", label: "Catégories", icon: <FaTags /> },
      { id: "kitchen", label: "Cuisine", icon: <FaUtensils /> }
    ]
  },
  {
    title: "💰 Caisses",
    items: [
      { id: "payments", label: "Paiements", icon: <FaMoneyBillWave /> },
      { id: "accountingCenter", label: "Centre Comptable", icon: <FaMoneyBillWave /> },
      { id: "salesHistory", label: "Historique des Ventes", icon: <FaChartLine /> },
      { id: "loyalty", label: "Points Fidélité", icon: <FaStar /> },
      { id: "promotions", label: "Promotions", icon: <FaTags /> },
      { id: "accountAdjustment", label: "État des Caisses", icon: <FaWallet /> }
    ]
  },
  {
    title: "💸 Dépenses",
    items: [
      { id: "budgets", label: "Gestion des Budgets", icon: <FaMoneyBillWave /> },
      { id: "expenseClassification", label: "Classification des Sorties", icon: <FaChartPie /> },
      { id: "expenseCleanup", label: "Nettoyage des Dépenses", icon: <FaBroom /> }
    ]
  },
  {
    title: "🚚 Livraisons",
    items: [
      { id: "deliveryDashboard", label: "Tableau de Bord Livraison", icon: <FaChartLine /> },
      { id: "deliveryTracking", label: "Suivi Livraisons", icon: <FaMapMarkedAlt /> },
      { id: "deliverers", label: "Livreurs", icon: <FaTruck /> },
      { id: "deliveryShifts", label: "Horaires Livreurs", icon: <FaClock /> },
      { id: "deliveryExpenses", label: "Dépenses Livraison", icon: <FaReceipt /> },
      { id: "partnerDashboard", label: "Dashboard Partenaires", icon: <FaHandshake /> },
      { id: "ambassadors", label: "Ambassadeurs", icon: <FaUserTie /> }
    ]
  },
  {
    title: "📦 Stock/Achat",
    items: [
      { id: "supplies", label: "Approvisionnements", icon: <FaBox /> },
      { id: "ingredients", label: "Ingrédients", icon: <FaBoxes /> },
      { id: "purchases", label: "Achats", icon: <FaShoppingCart /> },
      { id: "supplyReports", label: "Rapports Appro", icon: <FaChartLine /> },
      { id: "purchaseSummary", label: "Résumé Achats", icon: <FaChartPie /> },
    ]
  },
  {
    title: "📊 Rapports",
    items: [
      { id: "reports", label: "Rapports", icon: <FaChartLine /> },
      { id: "accountingReports", label: "Rapports Comptables", icon: <FaFileExport /> },
      { id: "comments", label: "Avis Clients", icon: <FaCommentAlt /> },
      { id: "managers", label: "Gestion des Utilisateurs", icon: <FaUsers /> },
      { id: "restaurant", label: "Infos Restaurant", icon: <FaCog /> },
      { id: "developer", label: "Interface Développeur", icon: <FaCode /> },
      { id: "userInterfaces", label: "Toutes les Interfaces", icon: <FaUsers /> }
    ]
  }
];

// Utiliser la structure universelle organisée en 6 sections pour tous les utilisateurs
const menuItems = useMemo(() => {
  if (!userRole) return [];
  
  // Debug: Afficher le rôle actuel
  console.log('Rôle utilisateur actuel:', userRole);
  
  // Utiliser la structure universelle pour tous les utilisateurs
  // Filtrer les éléments selon les permissions du rôle
  const filteredSections = universalMenuSections.map(section => {
    const filteredItems = section.items.filter(item => {
      // Vérifier si l'utilisateur a accès à cet élément
      try {
        return hasPermission(userRole, item.id, 'view');
      } catch (error) {
        // En cas d'erreur, permettre l'accès par défaut
        console.warn(`Erreur lors de la vérification des permissions pour ${item.id}:`, error);
        return true;
      }
    });
    
    // Retourner la section seulement si elle contient des éléments accessibles
    return filteredItems.length > 0 ? { ...section, items: filteredItems } : null;
  }).filter(section => section !== null);
  
  console.log('Sections filtrées pour le rôle:', userRole, filteredSections);
  return filteredSections;
}, [userRole]);

  // Hook de gestion des commandes (migration progressive)
  const {
    orders: hookOrders,
    loadingOrders,
    ordersError,
    updateOrderStatus: hookUpdateOrderStatus,
    updateOrderDeliveryFees: hookUpdateOrderDeliveryFees,
    deleteOrder: hookDeleteOrder,
  } = useOrdersAdmin({ currentRestaurantId, extraLists, items });

  // Fonction pour obtenir le numéro de semaine
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const resetItemForm = () => {
    setItemData({
      name: "",
      description: "",
      priceType: "single",
      price: "",
      sizes: { L: "", XL: "" },
      saleMode: "pack",
      categoryId: "",
      available: true,
      scheduledDay: [],
      needAssortement: false,
      assortments: [],
      extraLists: [],
      quantityleft: 0,
      covers: [],
      coverPreviews: [],
      menuId: "",
    });
    setEditingItem(null);
  };

  // Periodically check remote payment status for orders with a transaction ref
  useEffect(() => {
    let timerId;
    const checkPendingPayments = async () => {
      const candidates = hookOrders.filter((o) => o && o.paymentRef && o.isPaid === false);
      if (!candidates.length) return;
      try {
        for (const o of candidates) {
          const url = `${API_URL}/api/payment/status?transaction_id=${encodeURIComponent(o.paymentRef)}`;
          const resp = await fetch(url);
          if (!resp.ok) continue;
          const data = await resp.json();
          if (data?.success && (data.status === 'success' || data.status === 'succeeded' || data.status === 'paid')) {
            // Mark order paid and notify UI
            await updateOrderStatus(o.id, o.status || ORDER_STATUS.PENDING, null, true);
            setPaymentNotice(`Paiement confirmé pour la commande #${o.id.slice(0,8)} (${formatPrice(o?.total || 0)} FCFA)`);
            setTimeout(() => setPaymentNotice(""), 5000);
          }
        }
      } catch (e) {
        console.warn('Payment status polling error', e);
      }
    };
    // poll every 30s on Orders section
    if (activeSection === 'orders') {
      checkPendingPayments();
      timerId = setInterval(checkPendingPayments, 30000);
    }
    return () => timerId && clearInterval(timerId);
  }, [hookOrders, activeSection]);

  // Toggle rapide de disponibilité d'un plat depuis la liste
  const toggleItemAvailability = async (itemId, currentValue) => {
    try {
      await updateDoc(doc(db, "items", itemId), { available: !currentValue, updatedAt: Timestamp.now() });
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, available: !currentValue } : it)));
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la disponibilité:", error);
      setError("Impossible de mettre à jour la disponibilité du plat");
    }
  };

  const uploadImages = useCallback(async (files) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;
    const validFiles = files.filter(file => 
      allowedTypes.includes(file.type) && file.size <= maxSize
    );
  
    if (validFiles.length !== files.length) {
      setError("Certains fichiers sont invalides (type ou taille > 5MB).");
    }
  
    const urls = await Promise.all(
      validFiles.map(async (file) => {
        const fileRef = ref(storage, `menus/${uuidv4()}_${file.name}`);
        await uploadBytes(fileRef, file);
        return getDownloadURL(fileRef);
      })
    );
    return urls;
  }, []);

const pendingOrders = useMemo(() => {
  return hookOrders.filter((order) => 
    order && order.id && order.status === ORDER_STATUS.PENDING
  );
}, [hookOrders]);
  const formatDateForComparison = (date) => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const filterOrdersByDate = (orders, date, mode) => {
    const selected = new Date(date);
    return orders.filter((order) => {
      // Utiliser timestamp en priorité, sinon createdAt, sinon updatedAt
      const dateField = order.timestamp || order.createdAt || order.updatedAt;
      if (!dateField) return false;
      const orderDate = dateField?.toDate
        ? dateField.toDate()
        : (dateField?.seconds ? new Date(dateField.seconds * 1000) : new Date(dateField));
      switch (mode) {
        case 'day':
          return formatDateForComparison(orderDate) === formatDateForComparison(selected);
        case 'week': {
          const startOfWeek = new Date(selected);
          startOfWeek.setDate(selected.getDate() - selected.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return orderDate >= startOfWeek && orderDate <= endOfWeek;
        }
        case 'month':
          return orderDate.getMonth() === selected.getMonth() && 
                 orderDate.getFullYear() === selected.getFullYear();
        default:
          return true;
      }
    });
  };

  const filteredOrders = useMemo(() => {
    const dateFilteredOrders = filterOrdersByDate(hookOrders, selectedDate, dateFilterMode);
    return dateFilteredOrders.filter((order) => {
      // Filtrer par restaurant si currentRestaurantId existe
      if (currentRestaurantId && order.restaurantId && order.restaurantId !== currentRestaurantId) {
        return false;
      }
      return true;
    });
  }, [hookOrders, selectedDate, dateFilterMode, currentRestaurantId]);

  const getDeliveryFee = (destination) => {
    return deliveryFees[destination] ?? DEFAULT_DELIVERY_FEE;
  };

  const ratedOrders = hookOrders.filter((order) => {
    const hasRating = order.rating && typeof order.rating === "object" && order.rating.rating !== undefined;
    const matchesRestaurant = order.restaurantId === currentRestaurantId;
    return hasRating && matchesRestaurant;
  });

  useEffect(() => {
    const loadRestaurantData = async () => {
      if (!currentRestaurantId) return;
      
      try {
        // Charger les données du restaurant de l'utilisateur connecté
        const restaurantDoc = await getDoc(doc(db, "restaurants", currentRestaurantId));
        if (restaurantDoc.exists()) {
          const data = restaurantDoc.data();
          setRestaurant({ id: restaurantDoc.id, ...data });
          setRestaurantForm({
            name: data.name || "",
            adresse: data.adresse || "",
            city: data.city || "",
            location: data.location || "",
            contact: data.contact || "",
          });
        }
        
        // Charger les données des utilisateurs
        const usersSnap = await getDocs(collection(db, "usersrestau"));
        setUsersData({
          byId: usersSnap.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}),
          byPhone: usersSnap.docs.reduce((acc, doc) => {
            if (doc.data().phone) acc[doc.data().phone] = doc.data();
            return acc;
          }, {}),
        });
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRestaurantData();
  }, [currentRestaurantId]);

  useEffect(() => {
    // Pour les utilisateurs avec accès à tous les restaurants (comptable), on ne vérifie pas currentRestaurantId
    if (!canAccessAllRestaurants() && !currentRestaurantId) return;

    const fetchStaticData = async () => {
      try {
        // Pour le comptable (currentRestaurantId === null), on charge toutes les données
        const menusQuery = currentRestaurantId 
          ? query(collection(db, "menus"), where("restaurantId", "==", currentRestaurantId))
          : collection(db, "menus");
        const categoriesQuery = currentRestaurantId
          ? query(collection(db, "categories"), where("restaurantId", "==", currentRestaurantId))
          : collection(db, "categories");
        const itemsQuery = currentRestaurantId
          ? query(collection(db, "items"), where("restaurantId", "==", currentRestaurantId))
          : collection(db, "items");
        const extraListsQuery = currentRestaurantId
          ? query(collection(db, "extraLists"), where("restaurantId", "==", currentRestaurantId))
          : collection(db, "extraLists");

        // Charger les livreurs
        const deliverersQuery = currentRestaurantId
          ? query(collection(db, "deliverers"), where("restaurantId", "==", currentRestaurantId))
          : collection(db, "deliverers");

        const [menusSnap, categoriesSnap, itemsSnap, extraListsSnap, feesSnap, deliverersSnap] = await Promise.all([
          getDocs(menusQuery),
          getDocs(categoriesQuery),
          getDocs(itemsQuery),
          getDocs(extraListsQuery),
          getDocs(collection(db, "quartiers")),
          getDocs(deliverersQuery),
        ]);

        setMenus(menusSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setCategories(categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setItems(itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setExtraLists(extraListsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setDeliverers(deliverersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setDeliveryFees(
          feesSnap.docs.reduce((acc, doc) => ({
            ...acc,
            [doc.data().name]: doc.data().fee,
          }), {})
        );
      } catch (err) {
        console.error("Erreur lors de la récupération des données statiques:", err);
        setError("Erreur lors du chargement des données statiques");
      }
    };

    // Les commandes sont maintenant gérées par le hook useOrdersAdmin

    const feedbackQuery = currentRestaurantId
      ? query(collection(db, "feedback"), where("restaurantId", "==", currentRestaurantId))
      : collection(db, "feedback");
    const unsubscribeFeedback = onSnapshot(feedbackQuery, (snapshot) => {
      const feedbackData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFeedbacks(feedbackData);
    }, (err) => {
      console.error("Erreur dans l'écoute des feedbacks:", err);
      setError("Erreur dans le suivi des feedbacks");
    });

    fetchStaticData();
    return () => {
      unsubscribeFeedback();
    };
  }, [currentRestaurantId]);

  // Les commandes sont maintenant rafraîchies automatiquement par useOrdersAdmin

  const addMenu = async () => {
    if (!menuData.name) {
      setError("Le nom du menu est requis.");
      return;
    }
  
    try {
      setLoading(true);
      setError(null);
      const uploadedCovers = menuData.covers.length > 0 ? await uploadImages(menuData.covers) : [];
      const newMenu = { 
        name: menuData.name, 
        restaurantId: currentRestaurantId, 
        covers: uploadedCovers,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "menus"), newMenu);
      setMenus([...menus, { id: docRef.id, ...newMenu }]);
  
      if (window.fbq) {
        window.fbq('trackCustom', 'AddMenu', {
          content_ids: [docRef.id],
          content_name: menuData.name,
          content_type: 'menu',
          restaurant_id: currentRestaurantId,
        });
      }
  
      setMenuData({ name: "", covers: [], coverPreviews: [] });
    } catch (error) {
      console.error("Erreur lors de la création du menu:", error);
      setError("Erreur lors de la création du menu : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async () => {
    if (!categoryData.name) {
      setError("Le nom de la catégorie est requis.");
      return;
    }
  
    try {
      setLoading(true);
      setError(null);
  
      let iconUrl = "";
      if (categoryData.iconFile) {
        const uploadedUrls = await uploadImages([categoryData.iconFile]);
        iconUrl = uploadedUrls[0] || "";
      } else {
        iconUrl = categoryData.icon || "";
      }
  
      const newCategory = {
        name: categoryData.name,
        description: categoryData.description || "",
        icon: iconUrl,
        restaurantId: currentRestaurantId,
        createdAt: Timestamp.now(),
      };
  
      const docRef = await addDoc(collection(db, "categories"), newCategory);
      setCategories([...categories, { id: docRef.id, ...newCategory }]);
      setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
  
      if (window.fbq) {
        window.fbq("trackCustom", "AddCategory", {
          content_ids: [docRef.id],
          content_name: categoryData.name,
          content_type: "category",
          restaurant_id: currentRestaurantId,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la création de la catégorie:", error);
      setError("Erreur lors de la création de la catégorie : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addExtraList = async () => {
    if (!extraListData.name) return;
    try {
      const newExtraList = { ...extraListData, restaurantId: currentRestaurantId };
      const docRef = await addDoc(collection(db, "extraLists"), newExtraList);
      setExtraLists([...extraLists, { id: docRef.id, ...newExtraList }]);
      setExtraListData({
        name: "",
        extraListElements: [{ name: "", price: "", required: false, multiple: false }],
      });
    } catch (error) {
      console.error("Erreur lors de la création de l'extra list:", error);
      setError("Erreur lors de la création de l'extra list");
    }
  };

  const deleteMenu = async (menuId) => {
    try {
      await deleteDoc(doc(db, "menus", menuId));
      setMenus(menus.filter((menu) => menu.id !== menuId));
    } catch (error) {
      console.error("Erreur lors de la suppression du menu:", error);
      setError("Erreur lors de la suppression du menu");
    }
  };

  const deleteCategory = async (categoryId) => {
    try {
      await deleteDoc(doc(db, "categories", categoryId));
      setCategories(categories.filter((category) => category.id !== categoryId));
    } catch (error) {
      console.error("Erreur lors de la suppression de la catégorie:", error);
      setError("Erreur lors de la suppression de la catégorie");
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, "items", itemId));
      setItems(items.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error("Erreur lors de la suppression du plat:", error);
      setError("Erreur lors de la suppression du plat");
    }
  };

  const deleteExtraList = async (extraListId) => {
    try {
      await deleteDoc(doc(db, "extraLists", extraListId));
      setExtraLists(extraLists.filter((ex) => ex.id !== extraListId));
    } catch (error) {
      console.error("Erreur lors de la suppression de l'extra list:", error);
      setError("Erreur lors de la suppression de l'extra list");
    }
  };

  const deleteOrder = async (orderId) => {
    try {
      await hookDeleteOrder(orderId);
      console.log(`Commande ${orderId} supprimée avec succès`);
    } catch (error) {
      console.error("Erreur lors de la suppression de la commande:", error);
      setError("Erreur lors de la suppression de la commande");
    }
  };

  const updateMenu = async () => {
    if (!editingMenu || !menuData.name) {
      setError("Le nom du menu est requis pour la mise à jour.");
      return;
    }
  
    try {
      setLoading(true);
      setError(null);
      const newCovers = menuData.covers.filter(file => file instanceof File);
      const existingCovers = menuData.covers.filter(url => typeof url === "string");
      const uploadedCovers = newCovers.length > 0 ? await uploadImages(newCovers) : [];
      const updatedCovers = [...existingCovers, ...uploadedCovers];
      const updatedData = { 
        name: menuData.name, 
        covers: updatedCovers,
        updatedAt: Timestamp.now(),
      };
      await updateDoc(doc(db, "menus", editingMenu.id), updatedData);
      setMenus(menus.map((menu) => 
        menu.id === editingMenu.id ? { ...menu, ...updatedData } : menu
      ));
      setEditingMenu(null);
      setMenuData({ name: "", covers: [], coverPreviews: [] });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du menu:", error);
      setError("Erreur lors de la mise à jour du menu : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditingMenu = (menu) => {
    setEditingMenu(menu);
    setMenuData({
      name: menu.name,
      covers: menu.covers || [],
      coverPreviews: menu.covers || [],
    });
  };

  const updateCategory = async () => {
    if (!editingCategory || !categoryData.name) {
      setError("Le nom de la catégorie est requis.");
      return;
    }
  
    try {
      setLoading(true);
      setError(null);
  
      let iconUrl = "";
      if (categoryData.iconFile) {
        const uploadedUrls = await uploadImages([categoryData.iconFile]);
        iconUrl = uploadedUrls[0] || "";
      } else {
        iconUrl = categoryData.icon || "";
      }
  
      const updatedData = {
        name: categoryData.name,
        description: categoryData.description || "",
        icon: iconUrl,
        updatedAt: Timestamp.now(),
      };
  
      await updateDoc(doc(db, "categories", editingCategory.id), updatedData);
      setCategories(
        categories.map((category) =>
          category.id === editingCategory.id ? { ...category, ...updatedData } : category
        )
      );
      setEditingCategory(null);
      setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la catégorie:", error);
      setError("Erreur lors de la mise à jour de la catégorie : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditingCategory = (category) => {
    setEditingCategory(category);
    setCategoryData({
      name: category.name,
      description: category.description,
      icon: category.icon || "",
      iconFile: null,
      iconPreview: category.icon || "",
    });
  };

  const addItem = async () => {
    if (!itemData.name || !itemData.categoryId || !itemData.menuId) {
      setError("Tous les champs obligatoires doivent être remplis.");
      return;
    }
    if (itemData.priceType === "single" && !itemData.price) {
      setError("Le prix est requis.");
      return;
    }
    if (itemData.priceType === "sizes" && (!itemData.sizes.L || !itemData.sizes.XL)) {
      setError("Les prix pour L et XL sont requis.");
      return;
    }
  
    try {
      const uploadedCovers = await uploadImages(itemData.covers);
      if (itemData.covers.length > 0 && uploadedCovers.length === 0) {
        setError("Échec du téléchargement des images");
        return;
      }
      const priceValue = itemData.priceType === "single" 
        ? convertPrice(itemData.price) 
        : Math.min(convertPrice(itemData.sizes.L || 0), convertPrice(itemData.sizes.XL || 0));
      if (isNaN(priceValue)) {
        setError("Prix invalide");
        return;
      }
      const newItem = {
        ...itemData,
        covers: uploadedCovers,
        restaurantId: currentRestaurantId,
        ...(itemData.priceType === "single" ? { price: itemData.price } : { sizes: itemData.sizes }),
      };
      const docRef = await addDoc(collection(db, "items"), newItem);
      setItems([...items, { id: docRef.id, ...newItem }]);
      await updateDoc(doc(db, "menus", itemData.menuId), { items: arrayUnion(docRef.id) });
  
      if (window.fbq) {
        window.fbq('track', 'AddProduct', {
          content_ids: [docRef.id],
          content_name: itemData.name,
          content_type: 'product',
          value: priceValue,
          currency: 'XAF',
          restaurant_id: currentRestaurantId,
        });
      } else {
        console.warn("Pixel Facebook non initialisé");
      }
  
      resetItemForm();
    } catch (error) {
      console.error("Erreur lors de l'ajout du plat:", error);
      setError("Erreur lors de l'ajout du plat : " + error.message);
      return;
    }
  };

  const updateItem = async (itemId, newData) => {
    try {
      const uploadedCovers = newData.covers.some(file => file instanceof File)
        ? await uploadImages(newData.covers.filter(file => file instanceof File))
        : [];
      const updatedCovers = [
        ...(newData.covers.filter(url => typeof url === "string")),
        ...uploadedCovers,
      ];
      const priceValue = newData.priceType === "single" 
        ? convertPrice(newData.price) 
        : Math.min(convertPrice(newData.sizes.L), convertPrice(newData.sizes.XL));
      const updatedData = {
        ...newData,
        covers: updatedCovers,
        ...(newData.priceType === "single" ? { price: newData.price } : { sizes: newData.sizes }),
      };
      await updateDoc(doc(db, "items", itemId), updatedData);
      setItems(items.map((item) => (item.id === itemId ? { ...item, ...updatedData } : item)));

      window.fbq('trackCustom', 'ModifyProduct', {
        content_ids: [itemId],
        content_name: newData.name,
        content_type: 'product',
        value: priceValue,
        currency: 'XAF',
        restaurant_id: currentRestaurantId,
      });

      resetItemForm();
    } catch (error) {
      console.error("Erreur lors de la mise à jour du plat:", error);
      setError("Erreur lors de la mise à jour du plat");
    }
  };

  const startEditing = (item) => {
    setEditingItem(item);
    const newItemData = {
      name: item.name || "",
      description: item.description || "",
      priceType: item.price ? "single" : "sizes",
      price: item.price ? String(item.price) : "",
      sizes: item.sizes
        ? {
            L: item.sizes.L !== undefined ? String(item.sizes.L) : "",
            XL: item.sizes.XL !== undefined ? String(item.sizes.XL) : "",
          }
        : { L: "", XL: "" },
      saleMode: item.saleMode || "pack",
      categoryId: item.categoryId || "",
      available: item.available !== undefined ? item.available : true,
      scheduledDay: Array.isArray(item.scheduledDay) ? item.scheduledDay : [],
      needAssortement: item.needAssortement !== undefined ? item.needAssortement : false,
      assortments: Array.isArray(item.assortments) ? item.assortments : [],
      extraLists: Array.isArray(item.extraLists) ? item.extraLists : [],
      quantityleft: item.quantityleft !== undefined ? Number(item.quantityleft) : 0,
      covers: Array.isArray(item.covers) ? item.covers : [],
      coverPreviews: Array.isArray(item.covers) ? item.covers : [],
      menuId: item.menuId || "",
    };
    setItemData(newItemData);
  };

  const updateRestaurantInfo = async () => {
    try {
      const restaurantRef = doc(db, "restaurants", currentRestaurantId);
      await updateDoc(restaurantRef, { ...restaurantForm, updatedAt: Timestamp.now() });
      setRestaurant({ ...restaurant, ...restaurantForm });
      alert("Informations du restaurant mises à jour");
    } catch (error) {
      console.error("Erreur lors de la mise à jour du restaurant:", error);
      setError("Erreur lors de la mise à jour du restaurant");
    }
  };

  const updateOrderDeliveryFees = async (orderId, destination, newFee) => {
    try {
      await hookUpdateOrderDeliveryFees(orderId, destination, newFee, deliveryFees);
      // Sync local cache if new destination fee added
      const feeNumber = Number(newFee);
      if (deliveryFees[destination] === undefined && !isNaN(feeNumber)) {
        setDeliveryFees((prev) => ({ ...prev, [destination]: feeNumber }));
      }
    } catch (error) {
      console.error("Erreur de mise à jour des frais:", error);
      setError("Erreur lors de la mise à jour des frais");
    }
  };

  const updateOrderStatus = async (orderId, status, reason = null, isPaid = false) => {
    try {
      await hookUpdateOrderStatus(orderId, status, reason, isPaid);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut ou création de la notification:", error);
      setError(`Erreur: ${error.message}`);
    }
  };

  const handleDragStart = (e, order) => {
    setDraggedOrder(order);
    e.dataTransfer.setData("text/plain", order.id);
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove("opacity-50");
    setDraggedOrder(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-gray-200");
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove("bg-gray-200");
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-gray-200");
    if (!draggedOrder || draggedOrder.status === newStatus) return;
    await updateOrderStatus(draggedOrder.id, newStatus);
  };

  const handleDaySelection = (day) => {
    setItemData({
      ...itemData,
      scheduledDay: itemData.scheduledDay.includes(day)
        ? itemData.scheduledDay.filter((d) => d !== day)
        : [...itemData.scheduledDay, day],
    });
  };

  const addExtraElement = () => {
    setExtraListData({
      ...extraListData,
      extraListElements: [
        ...extraListData.extraListElements,
        { name: "", price: "", required: false, multiple: false },
      ],
    });
  };

  const updateExtraElement = (index, field, value) => {
    const newElements = extraListData.extraListElements.map((el, i) => {
      if (i !== index) return el;
      const updatedElement = { ...el, [field]: value };
      if (field === "required" && value) updatedElement.multiple = false;
      if (field === "multiple" && value) updatedElement.required = false;
      return updatedElement;
    });
    setExtraListData({ ...extraListData, extraListElements: newElements });
  };

  const showOrderDetails = (order) => {
    setSelectedOrder(order);
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
  };

  const handlePreviousPeriod = () => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === 'day') newDate.setDate(newDate.getDate() - 1);
    else if (dateFilterMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (dateFilterMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === 'day') newDate.setDate(newDate.getDate() + 1);
    else if (dateFilterMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (dateFilterMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  const addAvailabilityToExistingItems = async () => {
    try {
      setLoading(true);
      const itemsToUpdate = items.filter(item => typeof item.available === "undefined");
  
      if (itemsToUpdate.length === 0) {
        alert("Tous les produits ont déjà un champ 'available'.");
        setLoading(false);
        return;
      }
  
      for (const item of itemsToUpdate) {
        const updatedData = {
          ...item,
          available: true,
          updatedAt: Timestamp.now(),
        };
  
        await updateDoc(doc(db, "items", item.id), { available: true, updatedAt: Timestamp.now() });
        console.log(`Champ 'available' ajouté au produit ${item.id}`);
      }
  
      alert(`Mise à jour terminée : ${itemsToUpdate.length} produits corrigés.`);
    } catch (error) {
      console.error("Erreur lors de l'ajout du champ 'available' :", error);
      setError("Erreur lors de la mise à jour des produits");
    } finally {
      setLoading(false);
    }
  };

  const generateSchemaOrgJSONLD = (items) => {
    return items.map((item) => ({
      "@context": "https://schema.org",
      "@type": "Product",
      "id": item.id,
      "name": item.name,
      "description": item.description || "Description non disponible",
      "image": item.covers?.[0] || "https://www.mangedabord.com/logo192.png",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "XAF",
        "price": item.priceType === "single" 
          ? convertPrice(item.price || "0") 
          : Math.min(convertPrice(item.sizes?.L || "0"), convertPrice(item.sizes?.XL || "0")),
        "availability": item.available === true 
          ? "https://schema.org/InStock" 
          : "https://schema.org/OutOfStock",
      },
      "url": `https://www.mangedabord.com/product/${item.id}`,
    }));
  };
  
  useEffect(() => {
    if (items.length > 0) {
      const schemaData = generateSchemaOrgJSONLD(items);
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(schemaData);
      document.head.appendChild(script);
      return () => document.head.removeChild(script);
    }
  }, [items]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        menuItems={menuItems}
        restaurantName={restaurant?.name || user?.name || "Restaurant"}
        userRole={userRole}
        userRoleLabel={ROLE_LABELS[userRole]}
        onSignOut={async () => {
          console.log('Déconnexion admin - redirection vers /loginrestau');
          await auth.signOut();
          navigate('/loginrestau');
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          restaurantName={restaurant?.name || user?.name || "Restaurant"}
          activeSectionLabel={menuItems.find((item) => item.id === activeSection)?.label}
          onToggleMobile={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          {/* Indicateur de rôle prioritaire */}
          <RolePriorityIndicator 
            userRole={userRole} 
            activeSection={activeSection} 
          />
          
          {activeSection === "orders" && (
            <RoleProtectedRoute requiredSection="orders">
              <div className="space-y-6">
                <OrdersToolbar
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  dateFilterMode={dateFilterMode}
                  setDateFilterMode={setDateFilterMode}
                  handlePreviousPeriod={handlePreviousPeriod}
                  handleNextPeriod={handleNextPeriod}
                  getWeekNumber={getWeekNumber}
                  pendingOrdersCount={pendingOrders.length}
                  setShowPendingModal={setShowPendingModal}
                  paymentNotice={paymentNotice}
                  userRole={userRole}
                  canViewFinances={canAccess('orders', 'viewFinances')}
                />
              </div>
            </RoleProtectedRoute>
          )}
        

        {/* Content Sections */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {activeSection === "dashboard" && (
            <RoleProtectedRoute requiredSection="dashboard">
              <div className="p-6">
                <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <ManagerDashboard 
                    orders={hookOrders}
                    deliverers={deliverers}
                  />
                </React.Suspense>
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "restaurant" && (
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-6 text-gray-800">Informations du Restaurant</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {["name", "adresse", "city", "location", "contact"].map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field === "name"
                        ? "Nom du restaurant"
                        : field === "adresse"
                          ? "Adresse"
                          : field === "city"
                            ? "Ville"
                            : field === "location"
                              ? "Coordonnées GPS"
                              : "Contact"}
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      value={restaurantForm[field]}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, [field]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <button
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  onClick={updateRestaurantInfo}
                >
                  Mettre à jour
                </button>
              </div>
            </div>
          )}

          {activeSection === "menus" && (
            <RoleProtectedRoute requiredSection="menus">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Gestion des Menus</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setActiveMenuSubSection("menus")}
                      className={`px-4 py-2 rounded-lg ${
                        activeMenuSubSection === "menus"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      Menus
                    </button>
                    <button
                      onClick={() => setActiveMenuSubSection("items")}
                      className={`px-4 py-2 rounded-lg ${
                        activeMenuSubSection === "items"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      Plats
                    </button>
                    <button
                      onClick={() => setActiveMenuSubSection("extras")}
                      className={`px-4 py-2 rounded-lg ${
                        activeMenuSubSection === "extras"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      Extras
                    </button>
                  </div>
                </div>
                {activeMenuSubSection === "menus" && (
                  <div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du menu *</label>
                        <input
                          type="text"
                          placeholder="Nom du menu"
                          className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                            !menuData.name && error ? "border-red-500" : ""
                          }`}
                          value={menuData.name}
                          onChange={(e) => setMenuData({ ...menuData, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Images du menu</label>
                        <input
                          type="file"
                          multiple
                          className="w-full p-2 border rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                          onChange={(e) => {
                            const files = Array.from(e.target.files);
                            const previews = files.map((file) => URL.createObjectURL(file));
                            setMenuData({
                              ...menuData,
                              covers: editingMenu ? [...menuData.covers, ...files] : files,
                              coverPreviews: editingMenu ? [...menuData.coverPreviews, ...previews] : previews,
                            });
                          }}
                        />
                      </div>
                      {menuData.coverPreviews.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Prévisualisation</label>
                          <div className="flex flex-wrap gap-2">
                            {menuData.coverPreviews.map((preview, index) => (
                              <div key={index} className="relative">
                                <img
                                  src={preview}
                                  alt={`Prévisualisation ${index + 1}`}
                                  className="w-24 h-24 object-cover rounded-lg"
                                />
                                <button
                                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                  onClick={() => {
                                    const newCovers = menuData.covers.filter((_, i) => i !== index);
                                    const newPreviews = menuData.coverPreviews.filter((_, i) => i !== index);
                                    setMenuData({ ...menuData, covers: newCovers, coverPreviews: newPreviews });
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex gap-4">
                      <button
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                        onClick={editingMenu ? updateMenu : addMenu}
                        disabled={loading}
                      >
                        {loading ? "Chargement..." : editingMenu ? "Mettre à jour" : "Créer Menu"}
                      </button>
                      {editingMenu && (
                        <button
                          className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                          onClick={() => {
                            setEditingMenu(null);
                            setMenuData({ name: "", covers: [], coverPreviews: [] });
                          }}
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                    <div className="mt-6">
                      <h2 className="text-2xl font-bold mb-6">Liste des Menus</h2>
                      {menus.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Aucun menu ajouté pour le moment</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {menus.map((menu) => (
                            <div
                              key={menu.id}
                              className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                            >
                              <div className="flex items-start space-x-4">
                                {menu.covers?.length > 0 ? (
                                  <div className="relative w-24 h-24">
                                    <img
                                      src={menu.covers[0]}
                                      alt={menu.name}
                                      className="w-full h-full object-cover rounded-lg"
                                      onError={(e) => (e.target.src = "/img/default.png")}
                                    />
                                    {menu.covers.length > 1 && (
                                      <span className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs rounded-full px-2 py-1">
                                        +{menu.covers.length - 1}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                                    <span className="text-gray-500 text-sm">Aucune image</span>
                                  </div>
                                )}
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-800">{menu.name}</h4>
                                  <p className="text-xs text-gray-500 mt-1">ID Restaurant: {menu.restaurantId}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex justify-between">
                                <button
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                  onClick={() => startEditingMenu(menu)}
                                >
                                  Modifier
                                </button>
                                <button
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  onClick={() => deleteMenu(menu.id)}
                                >
                                  Supprimer
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeMenuSubSection === "items" && (
                  <div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h2 className="text-2xl font-bold mb-6">Gestion des Plats</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nom du plat *</label>
                          <input
                            type="text"
                            placeholder="Entrez le nom du plat"
                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                              !itemData.name && error ? "border-red-500" : ""
                            }`}
                            value={itemData.name}
                            onChange={(e) => setItemData({ ...itemData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Menu *</label>
                          <select
                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                              !itemData.menuId && error ? "border-red-500" : ""
                            }`}
                            value={itemData.menuId}
                            onChange={(e) => setItemData({ ...itemData, menuId: e.target.value })}
                          >
                            <option value="">Sélectionner un menu</option>
                            {menus.map((menu) => (
                              <option key={menu.id} value={menu.id}>
                                {menu.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                          <select
                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                              !itemData.categoryId && error ? "border-red-500" : ""
                            }`}
                            value={itemData.categoryId}
                            onChange={(e) => setItemData({ ...itemData, categoryId: e.target.value })}
                          >
                            <option value="">Sélectionner une catégorie</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type de prix *</label>
                          <select
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            value={itemData.priceType}
                            onChange={(e) => setItemData({ ...itemData, priceType: e.target.value })}
                          >
                            <option value="single">Prix unique</option>
                            <option value="sizes">Prix par taille (L/XL)</option>
                          </select>
                        </div>
                        {itemData.priceType === "single" ? (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA) *</label>
                            <input
                              type="number"
                              placeholder="Prix"
                              className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                                !itemData.price && error ? "border-red-500" : ""
                              }`}
                              value={itemData.price}
                              onChange={(e) => setItemData({ ...itemData, price: e.target.value })}
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prix par taille (FCFA) *</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="Prix L"
                                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                                  !itemData.sizes.L && error ? "border-red-500" : ""
                                }`}
                                value={itemData.sizes.L}
                                onChange={(e) =>
                                  setItemData({ ...itemData, sizes: { ...itemData.sizes, L: e.target.value } })
                                }
                              />
                              <input
                                type="number"
                                placeholder="Prix XL"
                                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                                  !itemData.sizes.XL && error ? "border-red-500" : ""
                                }`}
                                value={itemData.sizes.XL}
                                onChange={(e) =>
                                  setItemData({ ...itemData, sizes: { ...itemData.sizes, XL: e.target.value } })
                                }
                              />
                            </div>
                          </div>
                        )}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            placeholder="Décrivez le plat..."
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-y"
                            rows="3"
                            value={itemData.description}
                            onChange={(e) => setItemData({ ...itemData, description: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Mode de vente</label>
                          <select
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            value={itemData.saleMode}
                            onChange={(e) => setItemData({ ...itemData, saleMode: e.target.value })}
                          >
                            <option value="pack">Pack</option>
                            <option value="kilo">Kilo</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Images</label>
                          <input
                            type="file"
                            multiple
                            className="w-full p-2 border rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                            onChange={(e) => {
                              const files = Array.from(e.target.files);
                              const previews = files.map((file) => URL.createObjectURL(file));
                              setItemData({
                                ...itemData,
                                covers: editingItem ? [...itemData.covers, ...files] : files,
                                coverPreviews: editingItem ? [...itemData.coverPreviews, ...previews] : previews,
                              });
                            }}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Extras</label>
                          <div className="flex flex-wrap gap-2">
                            {extraLists.length > 0 ? (
                              extraLists.map((extra) => (
                                <div
                                  key={extra.id}
                                  className={`px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                                    itemData.extraLists.includes(extra.id)
                                      ? "bg-green-500 text-white"
                                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  }`}
                                  onClick={() => {
                                    setItemData({
                                      ...itemData,
                                      extraLists: itemData.extraLists.includes(extra.id)
                                        ? itemData.extraLists.filter((id) => id !== extra.id)
                                        : [...itemData.extraLists, extra.id],
                                    });
                                  }}
                                >
                                  {extra.name} ({extra.extraListElements.length})
                                </div>
                              ))
                            ) : (
                              <p className="text-gray-500 text-sm">Aucune liste d'extras disponible</p>
                            )}
                          </div>
                        </div>
                        {itemData.coverPreviews?.length > 0 && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Prévisualisation des images
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {itemData.coverPreviews.map((preview, index) => (
                                <div key={index} className="relative">
                                  <img
                                    src={preview}
                                    alt={`Prévisualisation ${index + 1}`}
                                    className="w-24 h-24 object-cover rounded-lg"
                                  />
                                  <button
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                    onClick={() => {
                                      const newCovers = itemData.covers.filter((_, i) => i !== index);
                                      const newPreviews = itemData.coverPreviews.filter((_, i) => i !== index);
                                      setItemData({ ...itemData, covers: newCovers, coverPreviews: newPreviews });
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilité</label>
                          <div className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50">
                            <span className="text-xs font-medium min-w-[86px] text-gray-700">
                              {itemData.available ? "Disponible" : "Indisponible"}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={!!itemData.available}
                                onChange={(e) => setItemData({ ...itemData, available: e.target.checked })}
                              />
                              <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                            <span className="text-xs text-gray-600">
                              {itemData.available ? "(mis en avant)" : "(affiché mais non commandable)"}
                            </span>
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Jours de disponibilité</label>
                          <div className="flex flex-wrap gap-2">
                            {["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"].map((day) => (
                              <button
                                key={day}
                                type="button"
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                  itemData.scheduledDay.includes(day)
                                    ? "bg-green-500 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                                onClick={() => handleDaySelection(day)}
                              >
                                {day.charAt(0).toUpperCase() + day.slice(1)}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-700 hover:bg-red-200"
                              onClick={() => setItemData({ ...itemData, scheduledDay: [] })}
                            >
                              Réinitialiser
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 flex gap-4">
                        <button
                          className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                          onClick={editingItem ? () => updateItem(editingItem.id, itemData) : addItem}
                        >
                          {editingItem ? "Mettre à jour" : "Ajouter le plat"}
                        </button>
                        {editingItem && (
                          <button
                            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                            onClick={resetItemForm}
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                      <div className="mt-6">
                        <h2 className="text-2xl font-bold mb-6">Liste des plats</h2>
                        {items.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">Aucun plat ajouté pour le moment</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                              >
                                <div className="flex items-start space-x-4">
                                  {item.covers?.length > 0 ? (
                                    <div className="relative w-24 h-24">
                                      <img
                                        src={item.covers[0]}
                                        alt={item.name}
                                        className="w-full h-full object-cover rounded-lg"
                                        onError={(e) => (e.target.src = "/img/default.png")}
                                      />
                                      {item.covers.length > 1 && (
                                        <span className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs rounded-full px-2 py-1">
                                          +{item.covers.length - 1}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                                      <span className="text-gray-500 text-sm">Aucune image</span>
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-800">{item.name}</h4>
                                    <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                                    <div className="mt-1">
                                      {item.available === false ? (
                                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Indisponible</span>
                                      ) : (
                                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Disponible</span>
                                      )}
                                    </div>
                                    {item.price ? (
                                      <p className="text-green-600 font-medium mt-1">{formatPrice(item.price)} FCFA</p>
                                    ) : (
                                      <p className="text-green-600 font-medium mt-1">
                                        L: {formatPrice(item.sizes?.L)} FCFA | XL: {formatPrice(item.sizes?.XL)} FCFA
                                      </p>
                                    )}
                                    {item.menuId && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Menu: {menus.find((m) => m.id === item.menuId)?.name || item.menuId}
                                      </p>
                                    )}
                                    {item.scheduledDay.length > 0 && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Disponible: {item.scheduledDay.join(", ")}
                                      </p>
                                    )}
                                    {item.extraLists?.length > 0 && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Extras: {item.extraLists.map((id) => extraLists.find((ex) => ex.id === id)?.name || id).join(", ")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-700">
                                      {item.available === false ? "Indisponible" : "Disponible"}
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={item.available !== false}
                                        onChange={() => toggleItemAvailability(item.id, item.available !== false)}
                                      />
                                      <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <button
                                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                      onClick={() => startEditing(item)}
                                    >
                                      Modifier
                                    </button>
                                    <button
                                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                                      onClick={() => deleteItem(item.id)}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {activeMenuSubSection === "extras" && (
                  <div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h2 className="text-2xl font-bold mb-6">Gestion des Extras</h2>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la liste d'extras *</label>
                          <input
                            type="text"
                            placeholder="Nom de la liste"
                            className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                              !extraListData.name && error ? "border-red-500" : ""
                            }`}
                            value={extraListData.name}
                            onChange={(e) => setExtraListData({ ...extraListData, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Éléments de la liste</label>
                          {extraListData.extraListElements.map((element, index) => (
                            <div key={index} className="flex gap-2 mb-2">
                              <input
                                type="text"
                                placeholder="Nom de l'élément"
                                className="w-full p-2 border rounded-lg"
                                value={element.name}
                                onChange={(e) => updateExtraElement(index, "name", e.target.value)}
                              />
                              <input
                                type="number"
                                placeholder="Prix (FCFA)"
                                className="w-32 p-2 border rounded-lg"
                                value={element.price}
                                onChange={(e) => updateExtraElement(index, "price", e.target.value)}
                              />
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={element.required}
                                  onChange={(e) => updateExtraElement(index, "required", e.target.checked)}
                                  className="mr-1"
                                />
                                Requis
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={element.multiple}
                                  onChange={(e) => updateExtraElement(index, "multiple", e.target.checked)}
                                  className="mr-1"
                                />
                                Multiple
                              </label>
                              <button
                                className="text-red-600 hover:text-red-800"
                                onClick={() =>
                                  setExtraListData({
                                    ...extraListData,
                                    extraListElements: extraListData.extraListElements.filter((_, i) => i !== index),
                                  })
                                }
                              >
                                Supprimer
                              </button>
                            </div>
                          ))}
                          <button
                            className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                            onClick={addExtraElement}
                          >
                            Ajouter un élément
                          </button>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                          onClick={addExtraList}
                          disabled={!extraListData.name}
                        >
                          Créer la liste
                        </button>
                      </div>
                      <div className="mt-6">
                        <h2 className="text-2xl font-bold mb-6">Liste des Extras</h2>
                        {extraLists.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">Aucune liste d'extras ajoutée pour le moment</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {extraLists.map((extraList) => (
                              <div
                                key={extraList.id}
                                className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                              >
                                <h4 className="font-semibold text-gray-800">{extraList.name}</h4>
                                <p className="text-sm text-gray-600">Éléments: {extraList.extraListElements.length}</p>
                                <div className="text-sm text-gray-600 mt-2">
                                  {extraList.extraListElements.map((element, index) => (
                                    <p key={index}>
                                      {element.name} ({element.price ? `${formatPrice(element.price)} FCFA` : "Gratuit"})
                                      {element.required && " (Requis)"}
                                      {element.multiple && " (Multiple)"}
                                    </p>
                                  ))}
                                </div>
                                <div className="mt-3 flex justify-between">
                                  <button
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    onClick={() => {
                                      setExtraListData({
                                        name: extraList.name,
                                        extraListElements: extraList.extraListElements,
                                      });
                                      setEditingExtraList(extraList.id);
                                    }}
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                                    onClick={() => {
                                      if (window.confirm("Voulez-vous vraiment supprimer cette liste d'extras ?")) {
                                        deleteExtraList(extraList.id);
                                      }
                                    }}
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "orders" && (
            <RoleProtectedRoute requiredSection="orders">
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-2xl font-bold mb-6">Gestion des Commandes</h2>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <button
                      className={`px-4 py-2 rounded-lg ${
                        activeOrderSubSection === "list" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                      } hover:bg-green-700 hover:text-white transition-colors`}
                      onClick={() => setActiveOrderSubSection("list")}
                    >
                      Liste des Commandes ({filteredOrders.length})
                    </button>
                  </div>
                </div>
                {error && <p className="text-red-600 mb-4">{error}</p>}
                {activeOrderSubSection === "list" && (
                  <div>
                    <div className="flex flex-wrap gap-4 mb-4">
                      <button
                        className={`px-4 py-2 rounded-lg ${
                          viewMode === "kanban" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                        } hover:bg-green-700 hover:text-white transition-colors`}
                        onClick={() => setViewMode("kanban")}
                      >
                        Vue Kanban
                      </button>
                      <button
                        className={`px-4 py-2 rounded-lg ${
                          viewMode === "list" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                        } hover:bg-green-700 hover:text-white transition-colors`}
                        onClick={() => setViewMode("list")}
                      >
                        Vue Liste
                      </button>
                    </div>
                    {viewMode === "kanban" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(STATUS_LABELS).map(([status, label]) => (
                          status !== ORDER_STATUS.FAILED && (
                            <div
                              key={status}
                              className={`border p-4 rounded-lg min-h-[200px] ${STATUS_COLUMN_COLORS[status]}`}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, status)}
                            >
                              <h3 className="text-lg font-semibold mb-3">{label}</h3>
                              <div className="space-y-3">
                                {filteredOrders
                                  .filter((order) => order.status === status)
                                  .map((order) => (
                                    <OrderCard
                                      key={order.id}
                                      order={order}
                                      items={items}
                                      extraLists={extraLists}
                                      usersData={usersData}
                                      deliverers={deliverers}
                                      onShowDetails={showOrderDetails}
                                      onDragStart={(e) => handleDragStart(e, order)}
                                      onDragEnd={handleDragEnd}
                                    />
                                  ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredOrders.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            items={items}
                            extraLists={extraLists}
                            usersData={usersData}
                            deliverers={deliverers}
                            onShowDetails={showOrderDetails}
                            onDragStart={(e) => handleDragStart(e, order)}
                            onDragEnd={handleDragEnd}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "createOrder" && (
            <RoleProtectedRoute requiredSection="createOrder">
              <CreateOrderForm
                items={items}
                extraLists={extraLists}
                restaurantId={currentRestaurantId}
                deliveryFees={deliveryFees}
                getDeliveryFee={getDeliveryFee}
                showTitle={false}
                userRole={userRole}
                canViewFinances={canAccess('createOrder', 'viewFinances')}
              />
            </RoleProtectedRoute>
          )}

          {activeSection === "categories" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Gestion des Catégories</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la catégorie *</label>
                    <input
                      type="text"
                      placeholder="Entrez le nom de la catégorie"
                      className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        !categoryData.name && error ? "border-red-500" : ""
                      }`}
                      value={categoryData.name}
                      onChange={(e) => setCategoryData({ ...categoryData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      placeholder="Décrivez la catégorie..."
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-y"
                      rows="3"
                      value={categoryData.description}
                      onChange={(e) => setCategoryData({ ...categoryData, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icône</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="w-full p-2 border rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        setCategoryData({
                          ...categoryData,
                          iconFile: file,
                          iconPreview: file ? URL.createObjectURL(file) : categoryData.icon,
                        });
                      }}
                    />
                  </div>
                  {categoryData.iconPreview && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prévisualisation de l'icône</label>
                      <div className="relative">
                        <img
                          src={categoryData.iconPreview}
                          alt="Prévisualisation de l'icône"
                          className="w-24 h-24 object-cover rounded-lg"
                          onError={(e) => (e.target.src = "/img/default.png")}
                        />
                        <button
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          onClick={() =>
                            setCategoryData({ ...categoryData, iconFile: null, iconPreview: "", icon: "" })
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex gap-4">
                  <button
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                    onClick={editingCategory ? updateCategory : addCategory}
                    disabled={loading || !categoryData.name}
                  >
                    {loading ? "Chargement..." : editingCategory ? "Mettre à jour" : "Créer catégorie"}
                  </button>
                  {editingCategory && (
                    <button
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
                      }}
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Liste des Catégories</h2>
                {categories.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucune catégorie ajoutée pour le moment</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                      >
                        <div className="flex items-start space-x-4">
                          {category.icon ? (
                            <img
                              src={category.icon}
                              alt={category.name}
                              className="w-24 h-24 object-cover rounded-lg"
                              onError={(e) => (e.target.src = "/img/default.png")}
                            />
                          ) : (
                            <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                              <span className="text-gray-500 text-sm">Aucune icône</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800">{category.name}</h4>
                            {category.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">ID Restaurant: {category.restaurantId}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-between">
                          <button
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            onClick={() => startEditingCategory(category)}
                          >
                            Modifier
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                            onClick={() => {
                              if (window.confirm("Voulez-vous vraiment supprimer cette catégorie ?")) {
                                deleteCategory(category.id);
                              }
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "promotions" && (
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              }
            >
              <PromotionManager restaurantId={currentRestaurantId} />
            </React.Suspense>
          )}

          {activeSection === "supplies" && (
            <RoleProtectedRoute requiredSection="supplies">
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
              >
                <SupplyManager 
                  currentRestaurantId={currentRestaurantId} 
                  userRole={userRole}
                  canViewFinances={canAccess('supplies', 'viewFinances')}
                />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "ingredients" && (
            <RoleProtectedRoute requiredSection="ingredients">
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
              >
                <IngredientsManager currentRestaurantId={currentRestaurantId} />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "purchases" && (
            <RoleProtectedRoute requiredSection="purchases">
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
              >
                <PurchasesManager currentRestaurantId={currentRestaurantId} userRole={userRole} />
              </React.Suspense>
            </RoleProtectedRoute>
          )}


          {activeSection === "purchaseSummary" && (
            <RoleProtectedRoute requiredSection="purchaseSummary">
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <PurchaseSummary currentRestaurantId={currentRestaurantId} />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "supplyReports" && (
            <RoleProtectedRoute requiredSection="supplyReports">
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
              >
                <SupplyReports currentRestaurantId={currentRestaurantId} />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "ambassadors" && (
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              }
            >
              <AmbassadorManager currentRestaurantId={currentRestaurantId} />
            </React.Suspense>
          )}

          {activeSection === "payments" && (
            <RoleProtectedRoute requiredSection="payments">
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
              >
                <AllPaymentsPage currentRestaurantId={currentRestaurantId} />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "loyalty" && (
            <RoleProtectedRoute requiredSection="loyalty">
              <LoyaltyPointsManager restaurantId={currentRestaurantId} />
            </RoleProtectedRoute>
          )}

          {activeSection === "salesHistory" && (
            <RoleProtectedRoute requiredSection="salesHistory">
              <div className="p-6">
                <SalesHistory />
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "comments" && (
            <CommentsSection feedbacks={feedbacks} usersData={usersData} orders={hookOrders} />
          )}

          {activeSection === "reports" && (
            <RoleProtectedRoute requiredSection="reports">
              <div className="p-6">
                <ReportsDashboard
                  orders={filteredOrders}
                  items={items}
                  extraLists={extraLists}
                  selectedDate={selectedDate}
                  dateFilterMode={dateFilterMode}
                  userRole={userRole}
                  canViewFinances={canAccess('reports', 'viewFinances')}
                />
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "managerExpenseTracker" && (
            <RoleProtectedRoute requiredSection="managerExpenseTracker">
              <AdminHeader
                title="Suivi des Dépenses par Gérant"
                subtitle="Analyse des performances financières et calcul des bénéfices par gérant"
                icon={<FaUsers />}
              />
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <ManagerExpenseTracker 
                  currentRestaurantId={currentRestaurantId}
                  userRole={userRole}
                />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "deliveryDashboard" && (
            <RoleProtectedRoute requiredSection="deliveryDashboard">
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <DeliveryFinancialDashboard 
                  currentRestaurantId={currentRestaurantId}
                />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "deliveryTracking" && (
            <RoleProtectedRoute requiredSection="deliveryTracking">
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <DeliveryTracking 
                  currentRestaurantId={currentRestaurantId}
                />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "deliverers" && (
            <RoleProtectedRoute requiredSection="deliverers">
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <DeliveryManager 
                  currentRestaurantId={currentRestaurantId} 
                  userRole={userRole}
                />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "deliveryShifts" && (
            <RoleProtectedRoute requiredSection="deliveryShifts">
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <DeliveryShiftManager 
                  currentRestaurantId={currentRestaurantId}
                />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "deliveryExpenses" && (
            <RoleProtectedRoute requiredSection="deliveryExpenses">
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <DeliveryExpensesManager 
                  currentRestaurantId={currentRestaurantId} 
                  userRole={userRole}
                />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "partnerDashboard" && (
            (() => {
              // Naviguer directement vers le dashboard partenaires
              navigate('/partner-deliveries', { 
                state: { 
                  restaurantId: currentRestaurantId,
                  userRole: userRole 
                } 
              });
              return null;
            })()
          )}

          {activeSection === "managers" && (
            <RoleProtectedRoute requiredSection="managers">
              <div className="p-6">
                <RoleBasedUserManager 
                  currentRestaurantId={currentRestaurantId} 
                  canAccessAllRestaurants={canAccessAllRestaurants}
                />
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "expenseApprovals" && (
            <RoleProtectedRoute requiredSection="expenseApprovals">
              <div
                className="p-3 sm:p-4 md:p-6"
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  minHeight: "100vh",
                }}
              >
                <AdminHeader
                  title="Approbations de Suppressions"
                  subtitle="Approuvez ou rejetez les demandes de suppression de dépenses"
                  icon={<FaCheckCircle />}
                />
                <div className="mt-4 sm:mt-6">
                  <Suspense fallback={<div className="text-center py-8">Chargement...</div>}>
                    <ExpenseDeletionApproval 
                      currentRestaurantId={currentRestaurantId} 
                      userRole={userRole}
                    />
                  </Suspense>
                </div>
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "budgets" && (
            <RoleProtectedRoute requiredSection="budgets">
              <div className="p-6">
                <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <BudgetManager 
                    orders={hookOrders}
                    userRole={userRole}
                    menus={menus}
                    categories={categories}
                    items={items}
                  />
                </React.Suspense>
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "expenseClassification" && (
            <RoleProtectedRoute requiredSection="expenseClassification">
              <div className="p-6">
                <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <ExpenseClassificationSystem 
                    currentRestaurantId={currentRestaurantId}
                    userRole={userRole}
                  />
                </React.Suspense>
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "expenseCleanup" && (
            <RoleProtectedRoute requiredSection="expenseCleanup">
              <div className="p-6">
                <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <ExpenseCleanupManager 
                    currentRestaurantId={currentRestaurantId}
                    userRole={userRole}
                  />
                </React.Suspense>
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "kitchen" && (
            <RoleProtectedRoute requiredSection="kitchen">
              <div className="p-6">
                <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                  <SimpleKitchenManager 
                    currentRestaurantId={currentRestaurantId}
                    userRole={userRole}
                  />
                </React.Suspense>
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "accountAdjustment" && (
            <RoleProtectedRoute requiredSection="accountAdjustment">
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <AccountAdjustmentManager userRole={userRole} />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "developer" && (
            <RoleProtectedRoute requiredSection="developer">
              <React.Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <DeveloperInterface userRole={userRole} />
              </React.Suspense>
            </RoleProtectedRoute>
          )}

          {activeSection === "userInterfaces" && (
            <RoleProtectedRoute requiredSection="userInterfaces">
              <UserInterfacesViewer userRole={userRole} />
            </RoleProtectedRoute>
          )}

          {activeSection === "historiqueCommandes" && (
            <RoleProtectedRoute requiredSection="historiqueCommandes">
              <div className="p-0 h-[calc(100vh-64px)]">
                <OrdersHistoryTable extraLists={extraLists} itemsCatalog={items} menusCatalog={menus} />
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "takeawayOrder" && (
            <RoleProtectedRoute requiredSection="takeawayOrder">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Commandes à Emporter</h1>
                    <p className="text-gray-600">Créer rapidement des commandes à emporter sans livraison</p>
                  </div>
                  <button
                    onClick={() => setShowTakeawayModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <FaPlusCircle />
                    <span>Nouvelle Commande</span>
                  </button>
                </div>
                
                {/* Affichage des commandes à emporter récentes */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Commandes à Emporter Récentes</h3>
                  <div className="space-y-3">
                    {hookOrders
                      .filter(order => order.type === 'takeaway')
                      .slice(0, 10)
                      .map(order => (
                        <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{order.customer?.name || 'Client'}</div>
                            <div className="text-sm text-gray-600">
                              {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('fr-FR') : ''}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">{order.total?.toLocaleString()} FCFA</div>
                            <div className="text-sm text-gray-600">{order.items?.length || 0} articles</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "accountingReports" && (
            <RoleProtectedRoute requiredSection="accountingReports">
              <div
                className="p-3 sm:p-4 md:p-6"
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  minHeight: "100vh",
                }}
              >
                <AdminHeader
                  title="Rapports Comptables"
                  subtitle="Analyses financières détaillées avec précisions sur les moyens de paiement"
                  icon={<FaFileExport />}
                />
                <div className="mt-4 sm:mt-6">
                  <Suspense fallback={<div className="text-center py-8">Chargement...</div>}>
                    <AccountingReports 
                      orders={hookOrders}
                      items={items}
                      extraLists={extraLists}
                      userRole={userRole}
                    />
                  </Suspense>
                </div>
              </div>
            </RoleProtectedRoute>
          )}

          {activeSection === "accountingCenter" && (
            <RoleProtectedRoute requiredSection="accountingCenter">
              <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
                <NewAccountingInterface
                  orders={hookOrders}
                  items={items}
                  extraLists={extraLists}
                  userRole={userRole}
                  currentRestaurantId={currentRestaurantId}
                />
              </Suspense>
            </RoleProtectedRoute>
          )}

          {selectedOrder && (
            <OrderDetailsModal
              order={selectedOrder}
              items={items}
              extraLists={extraLists}
              usersData={usersData}
              onClose={closeOrderDetails}
              onUpdateFees={updateOrderDeliveryFees}
              onDelete={deleteOrder}
              onUpdateStatus={updateOrderStatus}
              onOrderUpdated={(updatedOrder) => {
                // Mettre à jour l'ordre dans l'état local
                setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
              }}
            />
          )}

          {showPendingModal && (
            <PendingOrdersModal
              orders={pendingOrders}
              items={items}
              extraLists={extraLists}
              usersData={usersData}
              onClose={() => setShowPendingModal(false)}
            />
          )}

          {showTakeawayModal && (
            <Suspense fallback={<div className="text-center py-8">Chargement...</div>}>
              <TakeawayOrderForm
                currentRestaurantId={currentRestaurantId}
                onClose={() => setShowTakeawayModal(false)}
                onOrderCreated={(newOrder) => {
                  setOrders(prev => [newOrder, ...prev]);
                  setShowTakeawayModal(false);
                }}
              />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  </div>
);
};

export default RestaurantAdmin;