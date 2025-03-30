import React, { useEffect, useState, useMemo } from "react";
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
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";

// Constantes harmonisées avec OrderStatus
const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  CANCELLED: "annulee",
};

const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "En attente",
  [ORDER_STATUS.PREPARING]: "En préparation",
  [ORDER_STATUS.DELIVERING]: "En livraison",
  [ORDER_STATUS.DELIVERED]: "Livrée",
  [ORDER_STATUS.CANCELLED]: "Annulée",
};

const STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-yellow-500 text-white",
  [ORDER_STATUS.PREPARING]: "bg-blue-500 text-white",
  [ORDER_STATUS.DELIVERING]: "bg-orange-500 text-white",
  [ORDER_STATUS.DELIVERED]: "bg-green-600 text-white",
  [ORDER_STATUS.CANCELLED]: "bg-red-600 text-white",
};

const STATUS_COLUMN_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-gray-100 border-gray-300",
  [ORDER_STATUS.PREPARING]: "bg-blue-50 border-blue-200",
  [ORDER_STATUS.DELIVERING]: "bg-yellow-50 border-yellow-200",
  [ORDER_STATUS.DELIVERED]: "bg-green-50 border-green-200",
};

const DEFAULT_DELIVERY_FEE = 1000;

const OrderCard = React.memo(
  ({ order, items, usersData, onDragStart, onDragEnd, onUpdateFees, onDelete, onUpdateStatus, deliveryFee }) => {
    const user = usersData[order.userId] || usersData[order.guestId];
    const clientInfo = user
      ? `${user.email || "Prénom inconnu"} ${user.lastName || ""}`
      : "Client inconnu";
    const phoneNumber = order.address?.phone || order.contact?.phone || "Non spécifié";
    const addressDescription = order.address?.completeAddress || order.destination || "Description non spécifiée";
    const additionalAddressInfo = order.address
      ? `${order.address.area}${order.address.instructions ? ` - ${order.address.instructions}` : ""}`
      : "";
    const restaurantOrderItems = order.items?.filter((orderItem) =>
      items.some((it) => it.id === orderItem.dishId)
    ) ?? [];

    if (restaurantOrderItems.length === 0) return null;

    const orderDate = order.timestamp
      ? new Date(order.timestamp.seconds * 1000).toLocaleString()
      : "Date inconnue";

    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="mb-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-transform duration-200"
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium text-gray-800">{clientInfo}</p>
            <p className="text-sm text-gray-500">Téléphone: {phoneNumber}</p>
            <p className="text-sm text-gray-500">Description adresse: {addressDescription}</p>
            {additionalAddressInfo && (
              <p className="text-sm text-gray-400">({additionalAddressInfo})</p>
            )}
            <p className="text-sm text-gray-500">Commandé le: {orderDate}</p>
          </div>
          <span className="text-sm font-semibold">{order.total || 0} FCFA</span>
        </div>

        <div className="mt-2 space-y-1">
          {restaurantOrderItems.map((i, index) => {
            const currentItem = items.find((it) => it.id === i.dishId);
            return (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {currentItem ? currentItem.name : "Plat inconnu"} (x{i.quantity})
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"
            }`}
          >
            {STATUS_LABELS[order.status] || "En attente"}
          </span>
          <div className="flex space-x-1">
           
           
           
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newFee = prompt(
                  `Frais pour ${order.address?.area || "destination inconnue"} (FCFA):`,
                  order.deliveryFees ?? deliveryFee
                );
                if (newFee !== null && !isNaN(newFee)) {
                  onUpdateFees(order.id, order.address?.area || "inconnu", Number(newFee));
                }
              }}
              className="text-xs p-1 bg-gray-200 rounded hover:bg-gray-300"
              aria-label="Modifier les frais de livraison"
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Voulez-vous vraiment supprimer cette commande ?")) {
                  onDelete(order.id);
                }
              }}
              className="text-xs p-1 bg-red-200 rounded hover:bg-red-300"
              aria-label="Supprimer la commande"
            >
              🗑️
            </button>
          </div>
        </div>
        <div className="mt-1 text-sm text-gray-600">
          Livraison: {order.deliveryFees !== undefined ? order.deliveryFees : deliveryFee} FCFA
        </div>
      </div>
    );
  }
);

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
  const [activeTab, setActiveTab] = useState("restaurant");
  const [viewMode, setViewMode] = useState("kanban");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);

  const daysOfWeek = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

  const [menuData, setMenuData] = useState({ name: "" });
  const [categoryData, setCategoryData] = useState({
    name: "",
    description: "",
    icon: "",
    iconFile: null,
  });
  const [itemData, setItemData] = useState({
    name: "",
    description: "",
    price: "",
    saleMode: "pack",
    categoryId: "",
    available: true,
    scheduledDay: [],
    needAssortement: false,
    assortments: [],
    extraLists: [],
    quantityleft: 0,
    covers: [],
    menuId: "",
  });
  const [extraListData, setExtraListData] = useState({
    name: "",
    extraListElements: [{ name: "", price: "", required: false, multiple: false }],
  });

  const statusColumns = useMemo(
    () => [
      { id: ORDER_STATUS.PENDING, name: STATUS_LABELS[ORDER_STATUS.PENDING], color: STATUS_COLUMN_COLORS[ORDER_STATUS.PENDING] },
      { id: ORDER_STATUS.PREPARING, name: STATUS_LABELS[ORDER_STATUS.PREPARING], color: STATUS_COLUMN_COLORS[ORDER_STATUS.PREPARING] },
      { id: ORDER_STATUS.DELIVERING, name: STATUS_LABELS[ORDER_STATUS.DELIVERING], color: STATUS_COLUMN_COLORS[ORDER_STATUS.DELIVERING] },
      { id: ORDER_STATUS.DELIVERED, name: STATUS_LABELS[ORDER_STATUS.DELIVERED], color: STATUS_COLUMN_COLORS[ORDER_STATUS.DELIVERED] },
    ],
    []
  );

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
        setUsersData(usersSnap.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
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

    fetchStaticData();
    return () => unsubscribeOrders();
  }, [currentRestaurantId]);

  const filteredOrders = useMemo(() => {
    if (!items.length) return [];
    return orders.filter((order) =>
      order.items?.some((item) => items.some((it) => it.id === item.dishId))
    );
  }, [orders, items]);

  const getDeliveryFee = (destination) => {
    return deliveryFees[destination] ?? DEFAULT_DELIVERY_FEE;
  };

  const uploadImages = async (files) => {
    const urls = [];
    for (const file of files) {
      const fileRef = ref(storage, `items/${uuidv4()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      urls.push(url);
    }
    return urls;
  };

  const addItem = async () => {
    if (!itemData.name || !itemData.categoryId || !itemData.menuId) return;
    try {
      const uploadedCovers = await uploadImages(itemData.covers);
      const newItem = { ...itemData, covers: uploadedCovers, restaurantId: currentRestaurantId };
      const docRef = await addDoc(collection(db, "items"), newItem);
      setItems([...items, { id: docRef.id, ...newItem }]);
      await updateDoc(doc(db, "menus", itemData.menuId), { items: arrayUnion(docRef.id) });
      setItemData({
        name: "",
        description: "",
        price: "",
        saleMode: "pack",
        categoryId: "",
        available: true,
        scheduledDay: [],
        needAssortement: false,
        assortments: [],
        extraLists: [],
        quantityleft: 0,
        covers: [],
        menuId: "",
      });
    } catch (error) {
      console.error("Erreur lors de l'ajout du plat:", error);
      setError("Erreur lors de l'ajout du plat");
    }
  };

  const addMenu = async () => {
    if (!menuData.name) return;
    try {
      const newMenu = { ...menuData, restaurantId: currentRestaurantId };
      const docRef = await addDoc(collection(db, "menus"), newMenu);
      setMenus([...menus, { id: docRef.id, ...newMenu }]);
      setMenuData({ name: "" });
    } catch (error) {
      console.error("Erreur lors de la création du menu:", error);
      setError("Erreur lors de la création du menu");
    }
  };

  const addCategory = async () => {
    if (!categoryData.name) return;
    try {
      const iconUrl = categoryData.iconFile
        ? await (async () => {
            const iconRef = ref(storage, `icons/${uuidv4()}_${categoryData.iconFile.name}`);
            await uploadBytes(iconRef, categoryData.iconFile);
            return await getDownloadURL(iconRef);
          })()
        : "";
      const newCategory = { ...categoryData, icon: iconUrl, restaurantId: currentRestaurantId };
      const docRef = await addDoc(collection(db, "categories"), newCategory);
      setCategories([...categories, { id: docRef.id, ...newCategory }]);
      setCategoryData({ name: "", description: "", icon: "", iconFile: null });
    } catch (error) {
      console.error("Erreur lors de la création de la catégorie:", error);
      setError("Erreur lors de la création de la catégorie");
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
      await deleteDoc(doc(db, "orders", orderId));
      console.log(`Commande ${orderId} supprimée avec succès`);
    } catch (error) {
      console.error("Erreur lors de la suppression de la commande:", error);
      setError("Erreur lors de la suppression de la commande");
    }
  };

  const updateMenu = async (menuId, newData) => {
    try {
      await updateDoc(doc(db, "menus", menuId), newData);
      setMenus(menus.map((menu) => (menu.id === menuId ? { ...menu, ...newData } : menu)));
    } catch (error) {
      console.error("Erreur lors de la mise à jour du menu:", error);
      setError("Erreur lors de la mise à jour du menu");
    }
  };

  const updateCategory = async (categoryId, newData) => {
    try {
      await updateDoc(doc(db, "categories", categoryId), newData);
      setCategories(categories.map((category) =>
        category.id === categoryId ? { ...category, ...newData } : category
      ));
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la catégorie:", error);
      setError("Erreur lors de la mise à jour de la catégorie");
    }
  };

  const updateItem = async (itemId, newData) => {
    try {
      await updateDoc(doc(db, "items", itemId), newData);
      setItems(items.map((item) => (item.id === itemId ? { ...item, ...newData } : item)));
    } catch (error) {
      console.error("Erreur lors de la mise à jour du plat:", error);
      setError("Erreur lors de la mise à jour du plat");
    }
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
    const feeNumber = Number(newFee);
    if (isNaN(feeNumber) || feeNumber < 0) return;

    try {
      const orderRef = doc(db, "orders", orderId);
      if (deliveryFees[destination] === undefined) {
        await setDoc(doc(db, "quartiers", destination), {
          fee: feeNumber,
          name: destination,
        });
        setDeliveryFees((prev) => ({ ...prev, [destination]: feeNumber }));
      }
      await updateDoc(orderRef, {
        deliveryFees: feeNumber,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Erreur de mise à jour des frais:", error);
      setError("Erreur lors de la mise à jour des frais");
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status, updatedAt: Timestamp.now() });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      setError("Erreur lors de la mise à jour du statut");
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
    updateOrderStatus(draggedOrder.id, newStatus);
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

  return (
    <div className="container mt-4">
      <h2>Administration de {restaurant?.name || "votre restaurant"}</h2>
      {loading && (
        <div className="text-center p-4">
          <div
            className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"
            role="status"
          >
            <span className="sr-only">Chargement...</span>
          </div>
        </div>
      )}
      {error && (
        <p className="text-center text-red-600 p-4" role="alert">
          {error}
        </p>
      )}
      {!loading && (
        <>
          <ul className="nav nav-tabs mb-4">
            {["restaurant", "menus", "items", "categories", "orders", "extras"].map((tab) => (
              <li key={tab} className="nav-item">
                <button
                  className={`nav-link ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "restaurant"
                    ? "Infos Restaurant"
                    : tab === "menus"
                    ? "Gestion des Menus"
                    : tab === "items"
                    ? "Gestion des Plats"
                    : tab === "categories"
                    ? "Gestion des Catégories"
                    : tab === "orders"
                    ? "Commandes"
                    : "Extras"}
                </button>
              </li>
            ))}
          </ul>

          {activeTab === "restaurant" && (
            <div>
              <h3>Infos Restaurant</h3>
              {["name", "adresse", "city", "location", "contact"].map((field) => (
                <input
                  key={field}
                  type="text"
                  name={field}
                  placeholder={
                    field === "name"
                      ? "Nom du restaurant"
                      : field === "adresse"
                      ? "Adresse"
                      : field === "city"
                      ? "Ville"
                      : field === "location"
                      ? "Coordonnées GPS"
                      : "Contact"
                  }
                  className="form-control mb-2"
                  value={restaurantForm[field]}
                  onChange={(e) => setRestaurantForm({ ...restaurantForm, [field]: e.target.value })}
                />
              ))}
              <button className="btn btn-primary" onClick={updateRestaurantInfo}>
                Mettre à jour les infos
              </button>
            </div>
          )}

          {activeTab === "menus" && (
            <>
              <input
                type="text"
                placeholder="Nom du menu"
                className="form-control mb-2"
                value={menuData.name}
                onChange={(e) => setMenuData({ ...menuData, name: e.target.value })}
              />
              <button className="btn btn-success" onClick={addMenu}>
                Créer Menu
              </button>
              <h3 className="mt-4">Liste des Menus</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>RestaurantId</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {menus.map((menu) => (
                    <tr key={menu.id}>
                      <td>{menu.name}</td>
                      <td>{menu.restaurantId}</td>
                      <td>
                        <button
                          className="btn btn-warning btn-sm me-2"
                          onClick={() =>
                            updateMenu(menu.id, { name: prompt("Nouveau nom :", menu.name) })
                          }
                        >
                          Modifier
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteMenu(menu.id)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {activeTab === "items" && (
            <>
              <input
                type="text"
                placeholder="Nom du plat"
                className="form-control mb-2"
                value={itemData.name}
                onChange={(e) => setItemData({ ...itemData, name: e.target.value })}
              />
              <select
                className="form-control mb-2"
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
              <div className="mb-3">
                <label className="form-label">Jours de disponibilité :</label>
                <div>
                  {daysOfWeek.map((day) => (
                    <label key={day} className="me-2">
                      <input
                        type="checkbox"
                        value={day}
                        checked={itemData.scheduledDay.includes(day)}
                        onChange={() => handleDaySelection(day)}
                      />
                      {day}
                    </label>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary ms-2"
                    onClick={() => setItemData({ ...itemData, scheduledDay: [] })}
                  >
                    Réinitialiser
                  </button>
                </div>
                {itemData.scheduledDay.length > 0 ? (
                  <p className="small mt-2">
                    Disponibilité sélectionnée : <strong>{itemData.scheduledDay.join(", ")}</strong>
                  </p>
                ) : (
                  <p className="small text-muted mt-2">
                    Aucun jour sélectionné (disponible tous les jours).
                  </p>
                )}
              </div>
              <select
                className="form-control mb-2"
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
              <input
                type="text"
                placeholder="Description du plat"
                className="form-control mb-2"
                value={itemData.description}
                onChange={(e) => setItemData({ ...itemData, description: e.target.value })}
              />
              <input
                type="number"
                placeholder="Prix du plat"
                className="form-control mb-2"
                value={itemData.price}
                onChange={(e) => setItemData({ ...itemData, price: e.target.value })}
              />
              <select
                className="form-control mb-2"
                value={itemData.saleMode}
                onChange={(e) => setItemData({ ...itemData, saleMode: e.target.value })}
              >
                <option value="pack">Pack</option>
                <option value="kilo">Kilo</option>
              </select>
              <input
                type="file"
                multiple
                className="form-control mb-2"
                onChange={(e) => setItemData({ ...itemData, covers: Array.from(e.target.files) })}
              />
              {extraLists.length > 0 && (
                <div className="mb-2">
                  <label>Extras :</label>
                  {extraLists.map((extra) => (
                    <div key={extra.id}>
                      <input
                        type="checkbox"
                        checked={itemData.assortments.includes(extra.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setItemData({
                            ...itemData,
                            assortments: checked
                              ? [...itemData.assortments, extra.id]
                              : itemData.assortments.filter((id) => id !== extra.id),
                          });
                        }}
                      />
                      {extra.name}
                      {extra.required && <span className="text-muted"> (Obligatoire)</span>}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-success" onClick={addItem}>
                Ajouter
              </button>
              <h3 className="mt-4">Liste des Plats</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Description</th>
                    <th>Prix</th>
                    <th>RestaurantId</th>
                    <th>Extras</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.description}</td>
                      <td>{item.price}</td>
                      <td>{item.restaurantId}</td>
                      <td>
                        {item.assortments?.map((assId) => {
                          const extra = extraLists.find((ex) => ex.id === assId);
                          return extra ? extra.name : assId;
                        }).join(", ") || "Aucun"}
                      </td>
                      <td>
                        <button
                          className="btn btn-warning btn-sm me-2"
                          onClick={() =>
                            updateItem(item.id, {
                              name: prompt("Nouveau nom :", item.name),
                              description: prompt("Nouvelle description :", item.description),
                              price: prompt("Nouveau prix :", item.price),
                            })
                          }
                        >
                          Modifier
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteItem(item.id)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {activeTab === "categories" && (
            <>
              <input
                type="text"
                placeholder="Nom de la catégorie"
                className="form-control mb-2"
                value={categoryData.name}
                onChange={(e) => setCategoryData({ ...categoryData, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Description de la catégorie"
                className="form-control mb-2"
                value={categoryData.description}
                onChange={(e) => setCategoryData({ ...categoryData, description: e.target.value })}
              />
              <input
                type="file"
                className="form-control mb-2"
                onChange={(e) => setCategoryData({ ...categoryData, iconFile: e.target.files[0] })}
              />
              <button className="btn btn-success" onClick={addCategory}>
                Créer Catégorie
              </button>
              <h3 className="mt-4">Liste des Catégories</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Description</th>
                    <th>RestaurantId</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td>{category.description}</td>
                      <td>{category.restaurantId}</td>
                      <td>
                        <button
                          className="btn btn-warning btn-sm me-2"
                          onClick={() =>
                            updateCategory(category.id, {
                              name: prompt("Nouveau nom :", category.name),
                              description: prompt("Nouvelle description :", category.description),
                            })
                          }
                        >
                          Modifier
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteCategory(category.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {activeTab === "orders" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestion des Commandes</h3>
                <button
                  className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300"
                  onClick={() => setViewMode(viewMode === "table" ? "kanban" : "table")}
                >
                  {viewMode === "table" ? "Vue Kanban" : "Vue Tableau"}
                </button>
              </div>

              {viewMode === "kanban" ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {statusColumns.map((column) => (
                    <div
                      key={column.id}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, column.id)}
                      className={`p-4 rounded-lg border ${column.color} min-h-[200px]`}
                    >
                      <h4 className="font-medium mb-3">
                        {column.name} (
                        {
                          filteredOrders.filter((order) =>
                            column.id === ORDER_STATUS.PENDING
                              ? !order.status || order.status === ORDER_STATUS.PENDING
                              : order.status === column.id
                          ).length
                        }
                        )
                      </h4>
                      {filteredOrders
                        .filter((order) =>
                          column.id === ORDER_STATUS.PENDING
                            ? !order.status || order.status === ORDER_STATUS.PENDING
                            : order.status === column.id
                        )
                        .map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            items={items}
                            usersData={usersData}
                            onDragStart={(e) => handleDragStart(e, order)}
                            onDragEnd={handleDragEnd}
                            onUpdateFees={updateOrderDeliveryFees}
                            onDelete={deleteOrder}
                            onUpdateStatus={updateOrderStatus}
                            deliveryFee={getDeliveryFee(order.address?.area)}
                          />
                        ))}
                    </div>
                  ))}
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Téléphone</th>
                      <th>Description Adresse</th>
                      <th>Infos Supp.</th>
                      <th>Plats commandés</th>
                      <th>Total</th>
                      <th>Frais</th>
                      <th>Date</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const restaurantOrderItems =
                        order.items?.filter((orderItem) => items.some((it) => it.id === orderItem.dishId)) ?? [];
                      if (restaurantOrderItems.length === 0) return null;

                      const user = usersData[order.userId] || usersData[order.guestId];
                      const clientInfo = user
                        ? `${user.firstName || ""} ${user.email || ""}`
                        : "Client inconnu";
                      const phoneNumber = order.address?.phone || order.contact?.phone || "Non spécifié";
                      const addressDescription =
                        order.address?.completeAddress || order.destination || "Description non spécifiée";
                      const additionalAddressInfo = order.address
                        ? `${order.address.area}${order.address.instructions ? ` - ${order.address.instructions}` : ""}`
                        : "";
                      const orderDate = order.timestamp
                        ? new Date(order.timestamp.seconds * 1000).toLocaleString()
                        : "Date inconnue";

                      return (
                        <tr key={order.id}>
                          <td>{clientInfo}</td>
                          <td>{phoneNumber}</td>
                          <td>{addressDescription}</td>
                          <td>{additionalAddressInfo || "N/A"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {restaurantOrderItems.map((i, index) => {
                              const currentItem = items.find((it) => it.id === i.dishId);
                              return (
                                <div key={index} className="flex items-center space-x-2">
                                  <span className="font-medium">{currentItem?.name || "Plat inconnu"}</span>
                                  <span className="text-gray-500">(x{i.quantity})</span>
                                </div>
                              );
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {order.total ? `${order.total} FCFA` : "Montant non précisé"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {order.deliveryFees !== undefined
                              ? `${order.deliveryFees} FCFA`
                              : `${getDeliveryFee(order.address?.area)} FCFA`}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{orderDate}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {STATUS_LABELS[order.status] || "En attente"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center space-x-2">
                              <button
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                                onClick={() => updateOrderStatus(order.id, ORDER_STATUS.PREPARING)}
                              >
                                cuisine
                              </button>
                              <button
                                className="px-3 py-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                                onClick={() => updateOrderStatus(order.id, ORDER_STATUS.DELIVERING)}
                              >
                                en route
                              </button>
                              <button
                                className="px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                onClick={() => updateOrderStatus(order.id, ORDER_STATUS.DELIVERED)}
                              >
                                Livrée
                              </button>
                              <button
                                className="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                                onClick={() => {
                                  if (window.confirm("Voulez-vous vraiment supprimer cette commande ?")) {
                                    deleteOrder(order.id);
                                  }
                                }}
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "extras" && (
            <>
              <h3>Créer une Extra List</h3>
              <input
                type="text"
                placeholder="Nom de l'extra list"
                className="form-control mb-2"
                value={extraListData.name}
                onChange={(e) => setExtraListData({ ...extraListData, name: e.target.value })}
              />
              {extraListData.extraListElements.map((el, index) => (
                <div key={index} className="mb-2 p-2 border rounded">
                  <input
                    type="text"
                    placeholder="Nom de l'élément"
                    className="form-control mb-1"
                    value={el.name}
                    onChange={(e) => updateExtraElement(index, "name", e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Prix (facultatif)"
                    className="form-control mb-1"
                    value={el.price}
                    onChange={(e) => updateExtraElement(index, "price", e.target.value)}
                  />
                  <div className="d-flex gap-3">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={el.required}
                        onChange={(e) => updateExtraElement(index, "required", e.target.checked)}
                      />
                      <label className="form-check-label">Obligatoire</label>
                    </div>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={el.multiple}
                        onChange={(e) => updateExtraElement(index, "multiple", e.target.checked)}
                      />
                      <label className="form-check-label">Multiple</label>
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary mb-2" onClick={addExtraElement}>
                Ajouter un élément
              </button>
              <br />
              <button className="btn btn-success" onClick={addExtraList}>
                Créer Extra List
              </button>
              <h3 className="mt-4">Liste des Extras</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Éléments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {extraLists.map((extra) => (
                    <tr key={extra.id}>
                      <td>{extra.name}</td>
                      <td>
                        {extra.extraListElements
                          ?.map((el) =>
                            `${el.name}${el.price ? ` (${el.price} FCFA)` : ""} - ${
                              el.required ? "Obligatoire" : el.multiple ? "Multiple" : "Optionnel"
                            }`
                          )
                          .join(", ") || "Aucun élément"}
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteExtraList(extra.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default RestaurantAdmin;