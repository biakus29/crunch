import React, { useEffect, useState, useMemo, useCallback } from "react";

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
import { 
  FaUtensils, 
  FaListAlt, 
  FaBox, 
  FaTags, 
  FaShoppingBag, 
  FaPlusCircle, 
  FaCommentAlt, 
  FaCog, 
  FaBars, 
  FaTimes,
  FaHome,
  FaChartLine,
  FaUser,
  FaBell,
  FaSearch,
  FaStar,
  FaChevronDown,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaShippingFast
} from "react-icons/fa";
import { HiOutlineLogout } from "react-icons/hi";
import LoyaltyPointsManager from "./LoyaltyPoints";
import CreateOrderForm from "./CreateOrderForm";
import PendingOrdersModal from "../components/admin/orders/PendingOrdersModal";
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
import AdminHeader from "../components/admin/AdminHeader";
import OrdersToolbar from "../components/admin/OrdersToolbar";
import CommentsSection from "../components/admin/CommentsSection";

const RestaurantAdmin = () => {
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
  const [orders, setOrders] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [usersData, setUsersData] = useState({});
  const [deliveryFees, setDeliveryFees] = useState({});
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [viewMode, setViewMode] = useState("kanban");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);
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
  const [activeSection, setActiveSection] = useState("orders");
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [activeMenuSubSection, setActiveMenuSubSection] = useState("menus");
  const [activeOrderSubSection, setActiveOrderSubSection] = useState("list");
const menuItems = [
  // { id: "dashboard", label: "Tableau de bord", icon: <FaHome /> },
  { id: "restaurant", label: "Infos Restaurant", icon: <FaCog /> },
  { id: "menus", label: "Menus", icon: <FaListAlt /> },
  { id: "orders", label: "Commandes", icon: <FaShoppingBag /> },
  { id: "categories", label: "Catégories", icon: <FaTags /> },
  { id: "promotions", label: "Promotions", icon: <FaTags /> },
  { id: "payments", label: "Paiements", icon: <FaMoneyBillWave /> },
  { id: "loyalty", label: "Points Fidélité", icon: <FaStar /> },
  { id: "comments", label: "Avis Clients", icon: <FaCommentAlt /> },
];

  // Hook de gestion des commandes (migration progressive)
  const {
    updateOrderStatus: hookUpdateOrderStatus,
    updateOrderDeliveryFees: hookUpdateOrderDeliveryFees,
    deleteOrder: hookDeleteOrder,
  } = useOrdersAdmin({ currentRestaurantId, extraLists, items });

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
  return orders.filter((order) => 
    order && order.id && order.status === ORDER_STATUS.PENDING
  );
}, [orders]);
  const formatDateForComparison = (date) => {
    return date.toISOString().split('T')[0];
  };

  const filterOrdersByDate = (orders, date, mode) => {
    const selected = new Date(date);
    return orders.filter((order) => {
      if (!order.timestamp) return false;
      const orderDate = new Date(order.timestamp.seconds * 1000);
      
      switch (mode) {
        case 'day':
          return formatDateForComparison(orderDate) === formatDateForComparison(selected);
        case 'week':
          const startOfWeek = new Date(selected);
          startOfWeek.setDate(selected.getDate() - selected.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return orderDate >= startOfWeek && orderDate <= endOfWeek;
        case 'month':
          return orderDate.getMonth() === selected.getMonth() && 
                 orderDate.getFullYear() === selected.getFullYear();
        default:
          return true;
      }
    });
  };

  const filteredOrders = useMemo(() => {
    if (!items.length) return [];
    const dateFilteredOrders = filterOrdersByDate(orders, selectedDate, dateFilterMode);
    return dateFilteredOrders.filter((order) =>
      order.items?.some((item) => items.some((it) => it.id === item.dishId))
    );
  }, [orders, items, selectedDate, dateFilterMode]);

  const getDeliveryFee = (destination) => {
    return deliveryFees[destination] ?? DEFAULT_DELIVERY_FEE;
  };

  const ratedOrders = orders.filter((order) => {
    const hasRating = order.rating && typeof order.rating === "object" && order.rating.rating !== undefined;
    const matchesRestaurant = order.restaurantId === currentRestaurantId;
    return hasRating && matchesRestaurant;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "restaurants"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const restaurantDoc = querySnapshot.docs[0];
          setCurrentRestaurantId(restaurantDoc.id);
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
        const usersSnap = await getDocs(collection(db, "usersrestau"));
        setUsersData({
          byId: usersSnap.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}),
          byPhone: usersSnap.docs.reduce((acc, doc) => {
            if (doc.data().phone) acc[doc.data().phone] = doc.data();
            return acc;
          }, {}),
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentRestaurantId) return;

    const fetchStaticData = async () => {
      try {
        const [menusSnap, categoriesSnap, itemsSnap, extraListsSnap, feesSnap] = await Promise.all([
          getDocs(query(collection(db, "menus"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(query(collection(db, "categories"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(query(collection(db, "items"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(query(collection(db, "extraLists"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(collection(db, "quartiers")),
        ]);

        setMenus(menusSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setCategories(categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setItems(itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setExtraLists(extraListsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
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

    const ordersQuery = query(collection(db, "orders"));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const allOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || ORDER_STATUS.PENDING,
      }));
      setOrders(allOrders);
    }, (err) => {
      console.error("Erreur dans l'écoute des commandes:", err);
      setError("Erreur dans le suivi des commandes");
    });

    const feedbackQuery = query(
      collection(db, "feedback"),
      where("restaurantId", "==", currentRestaurantId)
    );
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
      unsubscribeOrders();
      unsubscribeFeedback();
    };
  }, [currentRestaurantId]);

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
        restaurantName={restaurant?.name}
        onSignOut={() => auth.signOut()}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          restaurantName={restaurant?.name}
          activeSectionLabel={menuItems.find((item) => item.id === activeSection)?.label}
          onToggleMobile={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          <AdminHeader
            title={menuItems.find((item) => item.id === activeSection)?.label || "Tableau de bord"}
            description={
              activeSection === "orders"
                ? "Gestion des commandes"
                : activeSection === "menus"
                ? "Gestion de vos menus, plats et extras"
                : activeSection === "restaurant"
                ? "Informations de votre établissement"
                : activeSection === "categories"
                ? "Gestion des catégories"
                : activeSection === "promotions"
                ? "Gestion des promotions et offres spéciales"
                : activeSection === "payments"
                ? "Visualisation et gestion des paiements"
                : activeSection === "loyalty"
                ? "Gestion des points de fidélité"
                : activeSection === "comments"
                ? "Avis et commentaires des clients"
                : "Tableau de bord administratif"
            }
          >
            {activeSection === "orders" && (
              <OrdersToolbar
                dateFilterMode={dateFilterMode}
                setDateFilterMode={setDateFilterMode}
                selectedDate={selectedDate}
                onPrev={handlePreviousPeriod}
                onNext={handleNextPeriod}
                getWeekNumber={getWeekNumber}
              />
            )}
          </AdminHeader>
        

        {/* Content Sections */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
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
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-6">Gestion des Menus</h2>
                <div className="flex flex-wrap gap-4 mb-4">
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      activeMenuSubSection === "menus" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                    } hover:bg-green-700 hover:text-white transition-colors`}
                    onClick={() => setActiveMenuSubSection("menus")}
                  >
                    Menus
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      activeMenuSubSection === "items" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                    } hover:bg-green-700 hover:text-white transition-colors`}
                    onClick={() => setActiveMenuSubSection("items")}
                  >
                    Plats
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      activeMenuSubSection === "extras" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                    } hover:bg-green-700 hover:text-white transition-colors`}
                    onClick={() => setActiveMenuSubSection("extras")}
                  >
                    Extras
                  </button>
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
                                <div className="mt-3 flex justify-between">
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
            </div>
          )}

          {activeSection === "orders" && (
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
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      activeOrderSubSection === "create" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                    } hover:bg-green-700 hover:text-white transition-colors`}
                    onClick={() => setActiveOrderSubSection("create")}
                  >
                    Créer une Commande
                  </button>
                 {/* <button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                    onClick={() => setShowPendingModal(true)}
                  >
                    <FaShoppingBag className="mr-2" />
                    Commandes en attente ({pendingOrders.length})
                  </button> */}
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
                            onShowDetails={showOrderDetails}
                            onDragStart={(e) => handleDragStart(e, order)}
                            onDragEnd={handleDragEnd}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeOrderSubSection === "create" && (
                  <div>
                    <h2 className="text-2xl font-bold mb-6">Créer une nouvelle commande</h2>
                    <CreateOrderForm
                      items={items}
                      extraLists={extraLists}
                      restaurantId={currentRestaurantId}
                      deliveryFees={deliveryFees}
                      getDeliveryFee={getDeliveryFee}
                    />
                  </div>
                )}
              </div>
            </div>
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
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Gestion des Promotions</h2>
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
              >
                <PromotionManager restaurantId={currentRestaurantId} />
              </React.Suspense>
            </div>
          )}

          {activeSection === "payments" && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Gestion des Paiements</h2>
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
              >
                <AllPaymentsPage />
              </React.Suspense>
            </div>
          )}

          {activeSection === "loyalty" && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Gestion des Points de Fidélité</h2>
              <LoyaltyPointsManager restaurantId={currentRestaurantId} />
            </div>
          )}

          {activeSection === "comments" && (
            <CommentsSection feedbacks={feedbacks} usersData={usersData} />
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
        </div>
      </main>
    </div>
  </div>
);
};

export default RestaurantAdmin;