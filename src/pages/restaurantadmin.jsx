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

// Constantes harmonisées avec les nouveaux états
const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  READY_TO_DELIVER: "pret_a_livrer",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  FAILED: "echec",
};

const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "En attente",
  [ORDER_STATUS.PREPARING]: "En préparation",
  [ORDER_STATUS.READY_TO_DELIVER]: "Prêt à livrer",
  [ORDER_STATUS.DELIVERING]: "En livraison",
  [ORDER_STATUS.DELIVERED]: "Livrée",
  [ORDER_STATUS.FAILED]: "Échec",
};

const STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-yellow-500 text-white",
  [ORDER_STATUS.PREPARING]: "bg-blue-500 text-white",
  [ORDER_STATUS.READY_TO_DELIVER]: "bg-purple-500 text-white",
  [ORDER_STATUS.DELIVERING]: "bg-orange-500 text-white",
  [ORDER_STATUS.DELIVERED]: "bg-green-600 text-white",
  [ORDER_STATUS.FAILED]: "bg-red-600 text-white",
};

const STATUS_COLUMN_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-gray-100 border-gray-300",
  [ORDER_STATUS.PREPARING]: "bg-blue-50 border-blue-200",
  [ORDER_STATUS.READY_TO_DELIVER]: "bg-purple-50 border-purple-200",
  [ORDER_STATUS.DELIVERING]: "bg-yellow-50 border-yellow-200",
  [ORDER_STATUS.DELIVERED]: "bg-green-50 border-green-200",
};

const DEFAULT_DELIVERY_FEE = 1000;

const FAILURE_REASONS = [
  "Client injoignable",
  "Adresse incorrecte",
  "Annulation par le client",
  "Problème de stock",
  "Erreur de livraison",
  "Autre",
];

const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const convertPrice = (price) => {
  if (typeof price === "string") {
    return parseFloat(price.replace(/\./g, ""));
  }
  return Number(price);
};

const calculateTimeDifferenceInMinutes = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate - startDate;
  return Math.floor(diffMs / (1000 * 60));
};

// Fonction utilitaire pour calculer subtotal et totalWithDelivery
const calculateOrderTotals = (order, extraLists) => {
  const subtotal = order.items.reduce((sum, item) => {
    const itemPrice = convertPrice(item.dishPrice || 0);
    const extrasTotal = item.selectedExtras
      ? Object.entries(item.selectedExtras).reduce((extraSum, [extraListId, indexes]) => {
          const extraList = extraLists.find((el) => el.id === extraListId)?.extraListElements || [];
          return extraSum + indexes.reduce((acc, index) => acc + Number(extraList[index]?.price || 0), 0);
        }, 0)
      : 0;
    return sum + (itemPrice + extrasTotal) * Number(item.quantity || 1);
  }, 0);
  const totalWithDelivery = subtotal + (order.deliveryFees !== undefined ? Number(order.deliveryFees) : DEFAULT_DELIVERY_FEE);
  return { subtotal, totalWithDelivery };
};

// Composant OrderCard optimisé pour un affichage clair et agrandi
const OrderCard = ({ order, items, extraLists, usersData, onShowDetails }) => {
  const user = usersData[order.userId] || (order.isGuest && order.contact ? { email: order.contact.name } : null);
  const clientInfo = user ? `${user.email || "Prénom inconnu"} ${user.lastName || ""}`.trim() : "Client inconnu";
  const { totalWithDelivery } = calculateOrderTotals(order, extraLists);

  return (
    <div className="mb-3 p-3 bg-white rounded-lg shadow-md border border-gray-200">
      <div className="flex flex-col space-y-2 text-base">
        <div className="font-medium text-gray-800 truncate" title={clientInfo}>
          Client: {clientInfo}
        </div>
        <div className="text-gray-600">ID: #{order.id.slice(0, 6)}</div>
        <div className="text-green-600 font-semibold">Total: {formatPrice(totalWithDelivery)} FCFA</div>
        <div>
          <span
            className={`inline-block px-2 py-1 rounded text-sm font-medium ${
              STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"
            }`}
          >
            Statut: {STATUS_LABELS[order.status] || "En attente"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`font-medium ${order.isPaid ? "text-green-600" : "text-red-600"}`}>
            Payé: {order.isPaid ? "Oui" : "Non"}
          </span>
          <button
            onClick={() => onShowDetails(order)}
            className="text-blue-600 hover:underline text-sm px-2 py-1"
          >
            Détails
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal OrderDetailsModal
const OrderDetailsModal = React.memo(({ order, items, extraLists, usersData, onClose, onUpdateFees, onDelete, onUpdateStatus }) => {
  const user = usersData[order.userId] || (order.isGuest && order.contact ? { email: order.contact.name } : null);
  const clientInfo = user ? `${user.email || "Prénom inconnu"} ${user.lastName || ""}`.trim() : "Client inconnu";
  const restaurantEmail = usersData[order.restaurantId]?.email || "Restaurant inconnu";
  const phoneNumber = order.address?.phone || order.contact?.phone || "Non spécifié";
  const addressDescription = order.address?.completeAddress || order.destination || "Non spécifiée";
  const additionalAddressInfo = order.address?.instructions || "";
  const orderDate = order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleString("fr-FR") : "Date inconnue";

  const [newStatus, setNewStatus] = useState(order.status || ORDER_STATUS.PENDING);
  const [failureReason, setFailureReason] = useState("");
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [isPaid, setIsPaid] = useState(order.isPaid || false);
  const [statusHistory, setStatusHistory] = useState([]);

  const { subtotal, totalWithDelivery } = useMemo(() => calculateOrderTotals(order, extraLists), [order, extraLists]);

  useEffect(() => {
    const statusHistoryQuery = query(collection(db, "orders", order.id, "statusHistory"));
    const unsubscribe = onSnapshot(statusHistoryQuery, (snapshot) => {
      const history = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setStatusHistory(history);
      if (history.length > 0) {
        setNewStatus(history[history.length - 1].status);
      }
    }, (error) => {
      console.error("Erreur lors de la récupération de l'historique des statuts:", error);
    });
    return () => unsubscribe();
  }, [order.id]);

  const getExtraName = (extraListId, index) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    const element = extraList?.extraListElements?.[index];
    return element ? `${element.name}${element.price ? ` (+${convertPrice(element.price).toLocaleString()} FCFA)` : ""}` : "Extra inconnu";
  };

  const handleStatusChange = async () => {
    if (newStatus === ORDER_STATUS.FAILED) {
      setShowFailureModal(true);
    } else {
      await onUpdateStatus(order.id, newStatus, null, isPaid);
      onClose();
    }
  };

  const handleFailureSubmit = async () => {
    if (failureReason) {
      await onUpdateStatus(order.id, ORDER_STATUS.FAILED, failureReason, isPaid);
      setShowFailureModal(false);
      onClose();
    }
  };

  const handleTogglePaid = async () => {
    const newPaidStatus = !isPaid;
    setIsPaid(newPaidStatus);
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, { isPaid: newPaidStatus, updatedAt: Timestamp.now() });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut payé:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl">
        <div className="sticky top-0 bg-white p-3 border-b flex justify-between items-center z-10">
          <h3 className="text-base font-semibold">Commande #{order.id.slice(0, 6)}</h3>
          <div className="flex items-center space-x-1">
            <span className="text-xs font-medium">{isPaid ? "Payé" : "Non payé"}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isPaid} onChange={handleTogglePaid} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>
        <div className="flex flex-col md:flex-row p-3 gap-3">
          <div className="md:w-1/2 space-y-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <h6 className="font-bold text-xs text-gray-800 mb-1">Client & Livraison</h6>
              <div className="text-xs text-gray-700 space-y-0.5">
                <p><span className="font-medium">Client :</span> {clientInfo}</p>
                <p><span className="font-medium">Tel :</span> {phoneNumber}</p>
                <p><span className="font-medium">Adresse :</span> {addressDescription}</p>
                {additionalAddressInfo && <p><span className="font-medium">Instr. :</span> {additionalAddressInfo}</p>}
                <p><span className="font-medium">Date :</span> {orderDate}</p>
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg">
              <h6 className="font-bold text-xs text-gray-800 mb-1">Paiement & Restaurant</h6>
              <div className="text-xs text-gray-700 space-y-0.5">
                <div className="flex items-center">
                  <i className={`${order.paymentMethod?.icon || "fa fa-credit-card"} text-green-600 text-sm mr-1`}></i>
                  <span>{order.paymentMethod?.name || "Non spécifié"}</span>
                </div>
                <p><span className="font-medium">Restaurant :</span> {restaurantEmail}</p>
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg">
              <h6 className="font-bold text-xs text-gray-800 mb-1">Historique</h6>
              {statusHistory.length > 0 ? (
                <div className="text-xs text-gray-700 space-y-1 max-h-40 overflow-y-auto">
                  {statusHistory.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex justify-between items-center p-1 border-b border-gray-200 ${
                        index === statusHistory.length - 1 ? "bg-gray-100" : ""
                      }`}
                    >
                      <span>
                        {index + 1}.{" "}
                        <span className={`px-1 rounded ${STATUS_COLORS[entry.status]}`}>
                          {STATUS_LABELS[entry.status] || entry.status}
                        </span>
                        {entry.reason && <span className="text-red-600"> ({entry.reason})</span>}
                        {index > 0 && (
                          <span className="text-green-600 ml-1">
                            (+{calculateTimeDifferenceInMinutes(statusHistory[index - 1].timestamp, entry.timestamp)} min)
                          </span>
                        )}
                      </span>
                      <span className="text-gray-500">
                        {entry.timestamp.toLocaleString("fr-FR")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Aucun historique</p>
              )}
            </div>
          </div>
          <div className="md:w-1/2 space-y-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <h6 className="font-bold text-xs text-gray-800 mb-1">Articles</h6>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {order.items.map((item, index) => {
                  const currentItem = items.find((it) => it.id === item.dishId);
                  return (
                    <div key={`${item.dishId}-${index}`} className="flex items-start">
                      <img
                        src={currentItem?.covers?.[0] || item.covers?.[0] || "/img/default.png"}
                        alt={item.dishName}
                        className="w-10 h-10 object-cover rounded mr-2"
                        onError={(e) => (e.target.src = "/img/default.png")}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-xs">{currentItem?.name || item.dishName || "Plat inconnu"}</p>
                          <p className="text-green-600 text-xs">{convertPrice(item.dishPrice).toLocaleString()} FCFA × {item.quantity}</p>
                        </div>
                        {item.selectedExtras && (
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            {Object.entries(item.selectedExtras).map(([extraListId, indexes]) => (
                              <p key={extraListId}>
                                <span className="font-medium">{extraLists.find((el) => el.id === extraListId)?.name || "Extras"} :</span>{" "}
                                {indexes.map((index) => getExtraName(extraListId, index)).join(", ")}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg">
              <h6 className="font-bold text-xs text-gray-800 mb-1">Résumé</h6>
              <div className="text-xs text-gray-700 space-y-0.5">
                <div className="flex justify-between">
                  <span>Sous-total :</span>
                  <span>{formatPrice(subtotal)} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>Frais :</span>
                  <span>{formatPrice(order.deliveryFees !== undefined ? order.deliveryFees : DEFAULT_DELIVERY_FEE)} FCFA</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-green-600">
                  <span>Total :</span>
                  <span>{formatPrice(totalWithDelivery)} FCFA</span>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-xs">Statut :</label>
              <select
                className="w-full p-1 border rounded text-xs"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <button className="w-full bg-blue-600 text-white p-1 rounded hover:bg-blue-700 text-xs" onClick={handleStatusChange}>
                Appliquer
              </button>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white p-3 border-t flex gap-2">
          <button
            className="flex-1 bg-gray-500 text-white p-1 rounded hover:bg-gray-600 text-xs"
            onClick={() => {
              const newFee = prompt("Nouveaux frais (FCFA):", order.deliveryFees || DEFAULT_DELIVERY_FEE);
              if (newFee !== null && !isNaN(newFee)) onUpdateFees(order.id, order.address?.area || "inconnu", Number(newFee));
            }}
          >
            Modifier frais
          </button>
          <button
            className="flex-1 bg-red-600 text-white p-1 rounded hover:bg-red-700 text-xs"
            onClick={() => {
              if (window.confirm("Supprimer cette commande ?")) {
                onDelete(order.id);
                onClose();
              }
            }}
          >
            Supprimer
          </button>
          <button className="flex-1 bg-gray-200 p-1 rounded hover:bg-gray-300 text-xs" onClick={onClose}>
            Fermer
          </button>
        </div>
        {showFailureModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-3 rounded-lg shadow-lg w-full max-w-xs">
              <h4 className="text-sm font-semibold mb-2">Motif de l'échec</h4>
              <select
                className="w-full p-1 border rounded text-xs mb-2"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
              >
                <option value="">Sélectionner un motif</option>
                {FAILURE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="flex-1 bg-gray-200 p-1 rounded hover:bg-gray-300 text-xs" onClick={() => setShowFailureModal(false)}>
                  Annuler
                </button>
                <button
                  className="flex-1 bg-blue-600 text-white p-1 rounded hover:bg-blue-700 text-xs"
                  onClick={handleFailureSubmit}
                  disabled={!failureReason}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

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
  const [selectedOrder, setSelectedOrder] = useState(null);

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
      { id: ORDER_STATUS.READY_TO_DELIVER, name: STATUS_LABELS[ORDER_STATUS.READY_TO_DELIVER], color: STATUS_COLUMN_COLORS[ORDER_STATUS.READY_TO_DELIVER] },
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

  const updateOrderStatus = async (orderId, status, reason = null, isPaid = false) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const statusHistoryRef = collection(orderRef, "statusHistory");
      const statusData = {
        status,
        timestamp: Timestamp.now(),
      };
      if (reason) statusData.reason = reason;

      await addDoc(statusHistoryRef, statusData);
      await updateDoc(orderRef, { status, isPaid, updatedAt: Timestamp.now() });
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
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {statusColumns.map((column) => (
                    <div
                      key={column.id}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, column.id)}
                      className={`p-4 rounded-lg border ${column.color} min-h-[300px] shadow-sm`}
                    >
                      <h4 className="font-semibold text-lg mb-4 text-gray-800">
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
                      
                      <div className="space-y-3">
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
                              extraLists={extraLists}
                              usersData={usersData}
                              onDragStart={(e) => handleDragStart(e, order)}
                              onDragEnd={handleDragEnd}
                              onUpdateFees={updateOrderDeliveryFees}
                              onDelete={deleteOrder}
                              onShowDetails={showOrderDetails}
                            />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table className="table w-full text-xs">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>ID Commande</th>
                      <th>Total</th>
                      <th>Statut</th>
                      <th>Payé</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const user = usersData[order.userId] || (order.isGuest && order.contact ? { email: order.contact.name } : null);
                      const clientInfo = user
                        ? `${user.email || "Prénom inconnu"} ${user.lastName || ""}`.trim()
                        : "Client inconnu";
                      const { totalWithDelivery } = calculateOrderTotals(order, extraLists);

                      return (
                        <tr key={order.id}>
                          <td className="truncate">{clientInfo}</td>
                          <td className="truncate">#{order.id.slice(0, 6)}</td>
                          <td className="text-green-600 font-semibold">{formatPrice(totalWithDelivery)} FCFA</td>
                          <td>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {STATUS_LABELS[order.status] || "En attente"}
                            </span>
                          </td>
                          <td className={order.isPaid ? "text-green-600" : "text-red-600"}>
                            {order.isPaid ? "Oui" : "Non"}
                          </td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm text-xs"
                              onClick={() => showOrderDetails(order)}
                            >
                              Détails
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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