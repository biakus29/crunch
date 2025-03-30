import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  onSnapshot,
  setDoc,
  Timestamp
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  CANCELLED: "annulee"
};

const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "En attente",
  [ORDER_STATUS.PREPARING]: "En préparation",
  [ORDER_STATUS.DELIVERING]: "En livraison",
  [ORDER_STATUS.DELIVERED]: "Livrée",
  [ORDER_STATUS.CANCELLED]: "Annulée"
};

const STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: "bg-yellow-500 text-white",
  [ORDER_STATUS.PREPARING]: "bg-blue-500 text-white",
  [ORDER_STATUS.DELIVERING]: "bg-orange-500 text-white",
  [ORDER_STATUS.DELIVERED]: "bg-green-600 text-white",
  [ORDER_STATUS.CANCELLED]: "bg-red-600 text-white"
};

const DEFAULT_DELIVERY_FEE = 1000;

const OrderStatus = ({ isAdmin = false }) => {
  const [orders, setOrders] = useState([]);
  const [itemsData, setItemsData] = useState({});
  const [extraLists, setExtraLists] = useState({});
  const [deliveryFees, setDeliveryFees] = useState({});
  const [usersData, setUsersData] = useState({ byId: {}, byPhone: {} });
  const [filter, setFilter] = useState(ORDER_STATUS.PENDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const statusColumns = useMemo(
    () => [
      {
        id: ORDER_STATUS.PENDING,
        name: STATUS_LABELS[ORDER_STATUS.PENDING],
        color: "bg-gray-100 border-gray-300"
      },
      {
        id: ORDER_STATUS.PREPARING,
        name: STATUS_LABELS[ORDER_STATUS.PREPARING],
        color: "bg-blue-50 border-blue-200"
      },
      {
        id: ORDER_STATUS.DELIVERING,
        name: STATUS_LABELS[ORDER_STATUS.DELIVERING],
        color: "bg-yellow-50 border-yellow-200"
      },
      {
        id: ORDER_STATUS.DELIVERED,
        name: STATUS_LABELS[ORDER_STATUS.DELIVERED],
        color: "bg-green-50 border-green-200"
      }
    ],
    []
  );

  // Récupération de l'ID authentifié via Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  // Calcul de l'identifiant effectif en tenant compte du mode invité (stocké dans localStorage)
  const effectiveUserId = useMemo(() => {
    return currentUserId || localStorage.getItem("guestUid");
  }, [currentUserId]);

  const fetchData = async () => {
    try {
      const [
        itemsSnapshot,
        extraListsSnapshot,
        feesSnapshot,
        usersSnapshot
      ] = await Promise.all([
        getDocs(collection(db, "items")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "extraLists")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "quartiers")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "usersrestau")).catch(() => ({ docs: [] }))
      ]);

      const itemsMap = itemsSnapshot.docs.reduce(
        (acc, doc) => ({ ...acc, [doc.id]: doc.data() }),
        {}
      );

      const extraMap = extraListsSnapshot.docs.reduce(
        (acc, doc) => ({ ...acc, [doc.id]: doc.data() }),
        {}
      );

      const feesMap = feesSnapshot.docs.reduce(
        (acc, doc) => ({ ...acc, [doc.id]: doc.data().fee }),
        {}
      );

      // Créer deux maps pour les utilisateurs : par uid et par numéro de téléphone
      const usersMapById = {};
      const usersMapByPhone = {};
      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        usersMapById[doc.id] = data;
        if (data.phone) {
          usersMapByPhone[data.phone] = data;
        }
      });

      setItemsData(itemsMap);
      setExtraLists(extraMap);
      setDeliveryFees(feesMap);
      setUsersData({ byId: usersMapById, byPhone: usersMapByPhone });
    } catch (err) {
      console.error("Erreur de chargement des données:", err);
      setError("Erreur de chargement des données de référence");
    }
  };

  useEffect(() => {
    if (effectiveUserId === null && !isAdmin) return;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        await fetchData();

        const ordersQuery = isAdmin
          ? query(collection(db, "orders"))
          : query(
              collection(db, "orders"),
              where("userId", "==", effectiveUserId)
            );

        const unsubscribe = onSnapshot(
          ordersQuery,
          (snapshot) => {
            const ordersData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
              status: doc.data().status || ORDER_STATUS.PENDING
            }));
            setOrders(ordersData);
            setLoading(false);
          },
          (err) => {
            console.error("Erreur dans l'écoute des commandes:", err);
            setError("Erreur de connexion au suivi des commandes");
            setLoading(false);
          }
        );

        return () => unsubscribe();
      } catch (err) {
        console.error("Erreur initiale des commandes:", err);
        setError("Erreur lors du chargement des commandes");
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isAdmin, effectiveUserId]);

  const filteredOrders = useMemo(() => {
    if (isAdmin) return orders;
    if (!filter) return orders;
    return orders.filter((order) => order.status === filter);
  }, [orders, filter, isAdmin]);

  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return "Date non disponible";
    return new Date(timestamp.seconds * 1000).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleDragStart = (e, order) => {
    e.dataTransfer.setData("orderId", order.id);
    setDraggedOrder(order);
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove("opacity-50");
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData("orderId");
    if (!orderId || draggedOrder?.status === newStatus) return;

    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      setDraggedOrder(null);
    } catch (error) {
      console.error("Erreur de mise à jour du statut:", error);
      setError("Impossible de mettre à jour le statut");
    }
  };

  const updateOrderDeliveryFees = async (orderId, destination, newFee) => {
    const feeNumber = Number(newFee);
    if (isNaN(feeNumber) || feeNumber < 0) return;

    try {
      const orderRef = doc(db, "orders", orderId);
      
      if (isAdmin && deliveryFees[destination] === undefined) {
        await setDoc(doc(db, "quartiers", destination), {
          fee: feeNumber,
          name: destination
        });
        setDeliveryFees((prev) => ({ ...prev, [destination]: feeNumber }));
      }

      await updateDoc(orderRef, {
        deliveryFees: feeNumber,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error("Erreur de mise à jour des frais:", error);
      setError("Erreur lors de la mise à jour des frais");
    }
  };

  const getDeliveryFee = (destination) => {
    return deliveryFees[destination] ?? DEFAULT_DELIVERY_FEE;
  };

  const renderKanban = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 px-4">
      {statusColumns.map((column) => (
        <div
          key={column.id}
          className={`${column.color} p-4 rounded-lg border min-h-[200px]`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          <h3 className="font-bold mb-3">
            {column.name} (
            {orders.filter((o) =>
              column.id === ORDER_STATUS.PENDING
                ? (!o.status || o.status === ORDER_STATUS.PENDING)
                : o.status === column.id
            ).length}
            )
          </h3>
          {orders
            .filter((order) =>
              column.id === ORDER_STATUS.PENDING
                ? (!order.status || order.status === ORDER_STATUS.PENDING)
                : order.status === column.id
            )
            .map((order) => (
              <div
                key={order.id}
                draggable
                onDragStart={(e) => handleDragStart(e, order)}
                onDragEnd={handleDragEnd}
                className="bg-white p-3 mb-2 rounded shadow-sm cursor-move transition-opacity"
              >
                <p className="font-medium">#{order.id.slice(0, 6)}</p>
                <p className="text-sm">
                  {order.items?.length || 0} article(s) - {order.total || 0} FCFA
                </p>
                <p className="text-sm">
                  Livraison: {order.destination || "Non spécifié"} (
                  {getDeliveryFee(order.destination)} FCFA)
                </p>
                <div className="flex justify-between items-center mt-1">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      STATUS_COLORS[order.status] || "bg-gray-400 text-white"
                    }`}
                  >
                    {STATUS_LABELS[order.status] || "En attente"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newFee = prompt(
                        `Frais pour ${order.destination || "destination inconnue"} (FCFA):`,
                        getDeliveryFee(order.destination)
                      );
                      if (newFee !== null) {
                        updateOrderDeliveryFees(
                          order.id,
                          order.destination || "inconnu",
                          newFee
                        );
                      }
                    }}
                    className="ml-2 text-xs p-1 bg-gray-200 rounded hover:bg-gray-300"
                    aria-label="Modifier les frais de livraison"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );

  const renderClientView = () => (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("")}
          className={`px-4 py-2 rounded-full text-sm ${
            !filter
              ? STATUS_COLORS[ORDER_STATUS.PENDING]
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Toutes
        </button>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-full text-sm ${
              filter === key
                ? STATUS_COLORS[key]
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">Aucune commande trouvée</p>
        </div>
      ) : (
        filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            itemsData={itemsData}
            extraLists={extraLists}
            formatDate={formatDate}
            badgeClasses={(status) =>
              STATUS_COLORS[status] || "bg-gray-400 text-white"
            }
            isAdmin={isAdmin}
            onUpdateFees={updateOrderDeliveryFees}
            deliveryFee={getDeliveryFee(order.destination)}
            usersData={usersData}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white border-b p-4 shadow-sm">
        <h2 className="text-center font-bold text-2xl">
          {isAdmin ? "Tableau de bord des commandes" : "Mes commandes"}
        </h2>
      </header>

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

      {!loading && orders.length === 0 && (
        <p className="text-center text-gray-500 p-4">
          {isAdmin ? "Aucune commande trouvée" : "Vous n'avez aucune commande"}
        </p>
      )}

      {!loading &&
        orders.length > 0 &&
        (isAdmin ? renderKanban() : renderClientView())}

      <Footer />
    </div>
  );
};

const OrderCard = ({
  order,
  itemsData,
  extraLists,
  formatDate,
  badgeClasses,
  isAdmin,
  onUpdateFees,
  deliveryFee,
  usersData
}) => {
  const displayStatus =
    STATUS_LABELS[order.status] || order.status || "En attente";

  // Récupération de l'utilisateur :
  // Si order.userId existe, recherche dans usersData.byId,
  // sinon, recherche via le numéro de téléphone dans order.contact.phone dans usersData.byPhone.
  let user = order.userId
    ? usersData.byId[order.userId]
    : order.contact?.phone && usersData.byPhone[order.contact.phone];

  let clientName, phoneNumber;

  if (user) {
    clientName =
      `${user.email || ""} ${user.lastName || ""}`.trim() ||
      "Utilisateur inconnu";
    phoneNumber = user.phone || order.selectedAddress?.phone || "Non fourni";
  } else {
    clientName = order.contact?.name || "Client inconnu";
    phoneNumber = order.contact?.phone || "Non fourni";
  }

  return (
    <div className="mb-6 bg-white rounded-lg shadow-lg p-4">
      <div className="flex flex-wrap items-center gap-4 border-b pb-3 mb-3">
        <span className={`px-3 py-1 rounded-full text-sm ${badgeClasses(order.status)}`}>
          {displayStatus}
        </span>
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
          <span>{formatDate(order.timestamp)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500">N° de commande</p>
          <p className="font-medium">#{order.id.slice(0, 8)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Total</p>
          <p className="font-medium text-green-600">
            {(order.total || 0).toLocaleString()} FCFA
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Livraison</p>
          <div className="flex items-center">
            <div>
              <p className="font-medium">{order.destination || "Non spécifié"}</p>
              <p className="text-sm">{deliveryFee.toLocaleString()} FCFA</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  const newFee = prompt(
                    `Frais pour ${order.destination || "destination inconnue"} (FCFA):`,
                    deliveryFee
                  );
                  if (newFee !== null) {
                    onUpdateFees(
                      order.id,
                      order.destination || "inconnu",
                      newFee
                    );
                  }
                }}
                className="ml-2 text-xs p-1 bg-gray-200 rounded hover:bg-gray-300"
                aria-label="Modifier les frais de livraison"
              >
                ✏️
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 bg-gray-50 p-2 rounded">
        <p className="text-sm font-bold">Coordonnées :</p>
        <p className="text-sm">
          {clientName} - {phoneNumber}
        </p>
      </div>

      <div className="mb-4">
        <h6 className="font-bold mb-3">Articles :</h6>
        <ul className="space-y-4">
          {order.items?.map((item, index) => (
            <OrderItem
              key={index}
              item={item}
              itemsData={itemsData}
              extraLists={extraLists}
            />
          )) || <li className="text-gray-500">Aucun article</li>}
        </ul>
      </div>
    </div>
  );
};

const OrderItem = ({ item, itemsData, extraLists }) => (
  <li className="pb-2 border-b border-gray-100">
    <div className="flex justify-between items-start">
      <div>
        <p className="font-medium">
          {itemsData[item.dishId]?.name || "Article inconnu"}
        </p>
        <p className="text-sm text-gray-500">
          Quantité : {item.quantity || 1}
        </p>
      </div>
      <p className="text-sm text-green-600">
        +{((itemsData[item.dishId]?.price || 0) * (item.quantity || 1)).toLocaleString()} FCFA
      </p>
    </div>
    {item.selectedExtras && (
      <div className="ml-4 mt-2">
        {Object.entries(item.selectedExtras).map(
          ([extraListId, indexes]) => (
            <div key={extraListId} className="text-sm text-gray-600">
              <p className="font-medium">
                {extraLists[extraListId]?.name || "Options"} :
              </p>
              <ul className="list-disc list-inside ml-2">
                {indexes.map((index) => {
                  const extra =
                    extraLists[extraListId]?.extraListElements?.[index] ||
                    {};
                  return (
                    <li key={index} className="flex justify-between">
                      <span>{extra.name || "Option supprimée"}</span>
                      {extra.price > 0 && (
                        <span className="text-green-500 ml-2">
                          +{(extra.price * (item.quantity || 1)).toLocaleString()} FCFA
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        )}
      </div>
    )}
  </li>
);

const Footer = () => (
  <footer className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg">
    <div className="grid grid-cols-4">
      <Link to="/" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
        <i className="fas fa-home text-lg"></i>
        <span className="block text-xs mt-1">Accueil</span>
      </Link>
      <Link to="/cart" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
        <i className="fas fa-shopping-cart text-lg"></i>
        <span className="block text-xs mt-1">Panier</span>
      </Link>
      <Link to="/orders" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
        <i className="fas fa-shopping-bag text-lg"></i>
        <span className="block text-xs mt-1">Commandes</span>
      </Link>
      <Link to="/account" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
        <i className="fas fa-user text-lg"></i>
        <span className="block text-xs mt-1">Compte</span>
      </Link>
    </div>
  </footer>
);

export default OrderStatus;
