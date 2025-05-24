import { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Tab, Tabs, Container, Button, Table, Alert, Form, Spinner } from "react-bootstrap";
import Chart from "chart.js/auto";
import { FaChartLine, FaMoneyBillWave, FaClock, FaShoppingBasket, FaTimesCircle, FaUsers } from "react-icons/fa";
import "../styles/addrestaurants.css";

const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  READY_TO_DELIVER: "pret_a_livrer",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  CANCELLED: "annulee",
  FAILED: "echec",
};

const formatPrice = (number) =>
  Number(number).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const formatDateForComparison = (date) => date.toISOString().split("T")[0];

const SuperAdmin = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [itemsData, setItemsData] = useState({});
  const [extraLists, setExtraLists] = useState({});
  const [quartiersList, setQuartiersList] = useState([]);
  const [usersRestau, setUsersRestau] = useState([]);
  const [activeTab, setActiveTab] = useState("restaurants");
  const [name, setName] = useState("");
  const [adresse, setAdresse] = useState("");
  const [city, setCity] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPartner, setIsPartner] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [restaurantToEdit, setRestaurantToEdit] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateFilterMode, setDateFilterMode] = useState("month");
  const chartRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const navigate = useNavigate();

  // Charger les données
  useEffect(() => {
    setIsLoading(true);
    const fetchData = async () => {
      try {
        const [
          restaurantsSnap,
          itemsSnap,
          extrasSnap,
          quartiersSnap,
          usersRestauSnap,
          usersRestauRealTimeSnap,
        ] = await Promise.all([
          getDocs(collection(db, "restaurants")),
          getDocs(collection(db, "items")),
          getDocs(collection(db, "extraLists")),
          getDocs(collection(db, "quartiers")),
          getDocs(collection(db, "usersrestau")),
          getDocs(collection(db, "usersRestau")),
        ]);

        setRestaurants(restaurantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setItemsData(itemsSnap.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
        setExtraLists(extrasSnap.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
        setQuartiersList(quartiersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        // Combiner et dédupliquer les utilisateurs
        const combinedUsers = [
          ...usersRestauSnap.docs.map((doc) => ({ id: doc.id, collection: "usersrestau", ...doc.data() })),
          ...usersRestauRealTimeSnap.docs.map((doc) => ({ id: doc.id, collection: "usersRestau", ...doc.data() })),
        ];

        // Éliminer les doublons en utilisant l'email ou l'uid comme clé unique
        const uniqueUsersMap = new Map();
        combinedUsers.forEach((user) => {
          const key = user.email && user.email !== "" ? user.email : user.uid || user.id;
          if (!uniqueUsersMap.has(key)) {
            uniqueUsersMap.set(key, user);
          }
        });
        const uniqueUsers = Array.from(uniqueUsersMap.values());
        setUsersRestau(uniqueUsers);

        // Écouter les mises à jour en temps réel
        const ordersQuery = collection(db, "orders");
        const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
          const allOrders = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              status: doc.data().status || ORDER_STATUS.PENDING,
            }))
            .filter((order) => order.items && order.items.length > 0);
          setOrders(allOrders);
        });

        const usersRestauQuery = collection(db, "usersrestau");
        const unsubscribeUsersRestau = onSnapshot(usersRestauQuery, (snapshot) => {
          const updatedUsersRestau = snapshot.docs.map((doc) => ({
            id: doc.id,
            collection: "usersrestau",
            ...doc.data(),
          }));
          const allUsers = [
            ...usersRestau.filter((user) => user.collection !== "usersrestau"),
            ...updatedUsersRestau,
          ];
          const uniqueUsersMap = new Map();
          allUsers.forEach((user) => {
            const key = user.email && user.email !== "" ? user.email : user.uid || user.id;
            if (!uniqueUsersMap.has(key)) {
              uniqueUsersMap.set(key, user);
            }
          });
          setUsersRestau(Array.from(uniqueUsersMap.values()));
        });

        const usersRestauRealTimeQuery = collection(db, "usersRestau");
        const unsubscribeUsersRestauRealTime = onSnapshot(usersRestauRealTimeQuery, (snapshot) => {
          const updatedUsersRestauRealTime = snapshot.docs.map((doc) => ({
            id: doc.id,
            collection: "usersRestau",
            ...doc.data(),
          }));
          const allUsers = [
            ...usersRestau.filter((user) => user.collection !== "usersRestau"),
            ...updatedUsersRestauRealTime,
          ];
          const uniqueUsersMap = new Map();
          allUsers.forEach((user) => {
            const key = user.email && user.email !== "" ? user.email : user.uid || user.id;
            if (!uniqueUsersMap.has(key)) {
              uniqueUsersMap.set(key, user);
            }
          });
          setUsersRestau(Array.from(uniqueUsersMap.values()));
        });

        return () => {
          unsubscribeOrders();
          unsubscribeUsersRestau();
          unsubscribeUsersRestauRealTime();
        };
      } catch (error) {
        setErrorMessage("Erreur lors du chargement des données : " + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const resetMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    if (!name || !adresse || !city || !contact || !email || !password) {
      setErrorMessage("Tous les champs sont obligatoires.");
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const restaurantRef = doc(collection(db, "restaurants"));
      await setDoc(restaurantRef, {
        id: restaurantRef.id,
        name,
        adresse,
        city,
        contact,
        email,
        isPartner,
        uid: userCredential.user.uid,
        idMenu: null,
        location: null,
      });

      setSuccessMessage("Restaurant créé avec succès !");
      setName("");
      setAdresse("");
      setCity("");
      setContact("");
      setEmail("");
      setPassword("");
      setIsPartner(false);
      setActiveTab("list");
      navigate("/superadmin");
    } catch (error) {
      setErrorMessage("Erreur lors de la création du restaurant : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRestaurant = async (id) => {
    resetMessages();
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "restaurants", id));
      setRestaurants(restaurants.filter((restaurant) => restaurant.id !== id));
      setSuccessMessage("Restaurant supprimé avec succès !");
    } catch (error) {
      setErrorMessage("Erreur lors de la suppression du restaurant : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRestaurant = async (e) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    if (!restaurantToEdit) {
      setErrorMessage("Aucun restaurant sélectionné pour la modification.");
      setIsLoading(false);
      return;
    }

    try {
      const restaurantRef = doc(db, "restaurants", restaurantToEdit.id);
      await updateDoc(restaurantRef, {
        name,
        adresse,
        city,
        contact,
        email,
        isPartner,
      });

      setSuccessMessage("Restaurant mis à jour avec succès !");
      setRestaurantToEdit(null);
      setActiveTab("list");
      navigate("/superadmin");
    } catch (error) {
      setErrorMessage("Erreur lors de la mise à jour du restaurant : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRestaurant = (restaurant) => {
    resetMessages();
    setRestaurantToEdit(restaurant);
    setName(restaurant.name);
    setAdresse(restaurant.adresse);
    setCity(restaurant.city);
    setContact(restaurant.contact);
    setEmail(restaurant.email);
    setIsPartner(restaurant.isPartner);
    setActiveTab("edit");
  };

  const handleDeleteUser = async (userId, collectionName) => {
    resetMessages();
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, collectionName, userId));
      setUsersRestau(usersRestau.filter((user) => user.id !== userId || user.collection !== collectionName));
      setSuccessMessage("Utilisateur supprimé avec succès !");
    } catch (error) {
      setErrorMessage("Erreur lors de la suppression de l'utilisateur : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filterOrdersByRestaurantAndDate = (orders, restaurantId, date, mode) => {
    const filteredByRestaurant = restaurantId
      ? orders.filter((order) => order.restaurantId === restaurantId)
      : orders;
    const selected = new Date(date);
    return filteredByRestaurant.filter((order) => {
      if (!order.timestamp) return false;
      const orderDate = new Date(order.timestamp.seconds * 1000);

      switch (mode) {
        case "day":
          return formatDateForComparison(orderDate) === formatDateForComparison(selected);
        case "week":
          const startOfWeek = new Date(selected);
          startOfWeek.setDate(selected.getDate() - selected.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return orderDate >= startOfWeek && orderDate <= endOfWeek;
        case "month":
          return (
            orderDate.getMonth() === selected.getMonth() &&
            orderDate.getFullYear() === selected.getFullYear()
          );
        default:
          return true;
      }
    });
  };

  const filteredOrders = filterOrdersByRestaurantAndDate(orders, selectedRestaurantId, selectedDate, dateFilterMode);

  const calculateTotalSales = () => {
    return filteredOrders.reduce((sum, order) => {
      const itemsTotal = order.items.reduce((acc, item) => {
        const itemPrice = Number(item.dishPrice || itemsData[item.dishId]?.price || 0);
        const extrasTotal = item.selectedExtras
          ? Object.entries(item.selectedExtras).reduce((extraSum, [extraListId, indexes]) => {
              const extraList = extraLists[extraListId]?.extraListElements || [];
              return extraSum + indexes.reduce((acc, index) => acc + Number(extraList[index]?.price || 0), 0);
            }, 0)
          : 0;
        return acc + (itemPrice + extrasTotal) * Number(item.quantity || 1);
      }, 0);
      const deliveryFee =
        Number(order.deliveryFee) ||
        (quartiersList.find((q) => q.name.toLowerCase() === order.address?.area?.toLowerCase())?.fee) ||
        1000;
      return sum + itemsTotal + deliveryFee;
    }, 0);
  };

  const calculateAverageOrderDuration = () => {
    const deliveredOrders = filteredOrders.filter((order) => order.status === ORDER_STATUS.DELIVERED);
    if (deliveredOrders.length === 0) return 0;
    const totalDuration = deliveredOrders.reduce((sum, order) => {
      const start = order.timestamp?.seconds ? order.timestamp.seconds * 1000 : 0;
      const end = order.updatedAt?.seconds ? order.updatedAt.seconds * 1000 : 0;
      return start && end ? sum + (end - start) / (1000 * 60) : sum;
    }, 0);
    return Math.round(totalDuration / deliveredOrders.length);
  };

  const calculateTopItems = () => {
    const itemCounts = {};
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const itemName = item.dishName || itemsData[item.dishId]?.name || "Inconnu";
        itemCounts[itemName] = (itemCounts[itemName] || 0) + Number(item.quantity || 1);
      });
    });
    return Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  };

  const calculateCancellationRate = () => {
    const cancelledOrders = filteredOrders.filter((order) => order.status === ORDER_STATUS.CANCELLED).length;
    return filteredOrders.length > 0 ? ((cancelledOrders / filteredOrders.length) * 100).toFixed(1) : 0;
  };

  const calculateRevenueByQuartier = () => {
    const revenueByQuartier = {};
    filteredOrders.forEach((order) => {
      const quartier = order.address?.area || "Non spécifié";
      const total = calculateTotalSalesForOrder(order);
      revenueByQuartier[quartier] = (revenueByQuartier[quartier] || 0) + total;
    });
    return Object.entries(revenueByQuartier).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };

  const calculateTotalSalesForOrder = (order) => {
    const itemsTotal = order.items.reduce((acc, item) => {
      const itemPrice = Number(item.dishPrice || itemsData[item.dishId]?.price || 0);
      const extrasTotal = item.selectedExtras
        ? Object.entries(item.selectedExtras).reduce((extraSum, [extraListId, indexes]) => {
            const extraList = extraLists[extraListId]?.extraListElements || [];
            return extraSum + indexes.reduce((acc, index) => acc + Number(extraList[index]?.price || 0), 0);
          }, 0)
        : 0;
      return acc + (itemPrice + extrasTotal) * Number(item.quantity || 1);
    }, 0);
    const deliveryFee =
      Number(order.deliveryFee) ||
      (quartiersList.find((q) => q.name.toLowerCase() === order.address?.area?.toLowerCase())?.fee) ||
      1000;
    return itemsTotal + deliveryFee;
  };

  // Calcul des statistiques des utilisateurs
  const calculateUserStats = () => {
    const totalUsers = usersRestau.length;
    const guestUsers = usersRestau.filter(
      (user) => !user.email || user.email === "" || user.isGuest
    ).length;
    const emailUsers = totalUsers - guestUsers;

    return {
      totalUsers,
      guestUsers,
      emailUsers,
    };
  };

  useEffect(() => {
    if (chartRef.current && filteredOrders.length > 0) {
      const salesByDate = filteredOrders.reduce((acc, order) => {
        const date = order.timestamp
          ? new Date(order.timestamp.seconds * 1000).toLocaleDateString("fr-FR")
          : "Inconnue";
        const total = calculateTotalSalesForOrder(order);
        acc[date] = (acc[date] || 0) + total;
        return acc;
      }, {});

      const labels = Object.keys(salesByDate);
      const data = Object.values(salesByDate);

      if (chartInstance) chartInstance.destroy();

      const ctx = chartRef.current.getContext("2d");
      const newChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Ventes (FCFA)",
              data,
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          scales: {
            y: { beginAtZero: true, title: { display: true, text: "Montant (FCFA)" } },
            x: { title: { display: true, text: "Date" } },
          },
        },
      });
      setChartInstance(newChart);
    }
    return () => {
      if (chartInstance) chartInstance.destroy();
    };
  }, [filteredOrders]);

  const totalSales = calculateTotalSales();
  const averageDuration = calculateAverageOrderDuration();
  const topItems = calculateTopItems();
  const cancellationRate = calculateCancellationRate();
  const topQuartiers = calculateRevenueByQuartier();
  const { totalUsers, guestUsers, emailUsers } = calculateUserStats();

  const handlePreviousPeriod = () => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === "day") newDate.setDate(newDate.getDate() - 1);
    else if (dateFilterMode === "week") newDate.setDate(newDate.getDate() - 7);
    else if (dateFilterMode === "month") newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(selectedDate);
    if (dateFilterMode === "day") newDate.setDate(newDate.getDate() + 1);
    else if (dateFilterMode === "week") newDate.setDate(newDate.getDate() + 7);
    else if (dateFilterMode === "month") newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  return (
    <Container className="mt-4">
      <h2 className="text-center mb-4">Gestion Super Admin</h2>

      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Tabs activeKey={activeTab} onSelect={(k) => { resetMessages(); setActiveTab(k); }} className="mb-3">
        <Tab eventKey="restaurants" title="Ajouter un Restaurant">
          <h3 className="mt-3">Ajouter un Restaurant</h3>
          <Form onSubmit={handleAddRestaurant}>
            <Form.Group className="mb-3">
              <Form.Label>Nom du Restaurant</Form.Label>
              <Form.Control type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Adresse</Form.Label>
              <Form.Control type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Ville</Form.Label>
              <Form.Control type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Contact</Form.Label>
              <Form.Control type="text" value={contact} onChange={(e) => setContact(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Mot de passe</Form.Label>
              <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check 
                type="checkbox"
                label="Partenaire ?"
                checked={isPartner}
                onChange={(e) => setIsPartner(e.target.checked)}
              />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? <Spinner as="span" animation="border" size="sm" /> : "Ajouter"}
            </Button>
          </Form>
        </Tab>

        <Tab eventKey="edit" title="Modifier un Restaurant">
          <h3 className="mt-3">Modifier un Restaurant</h3>
          {restaurantToEdit ? (
            <Form onSubmit={handleUpdateRestaurant}>
              <Form.Group className="mb-3">
                <Form.Label>Nom du Restaurant</Form.Label>
                <Form.Control type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Adresse</Form.Label>
                <Form.Control type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Ville</Form.Label>
                <Form.Control type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Contact</Form.Label>
                <Form.Control type="text" value={contact} onChange={(e) => setContact(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check 
                  type="checkbox"
                  label="Partenaire ?"
                  checked={isPartner}
                  onChange={(e) => setIsPartner(e.target.checked)}
                />
              </Form.Group>
              <Button variant="primary" type="submit" disabled={isLoading}>
                {isLoading ? <Spinner as="span" animation="border" size="sm" /> : "Mettre à jour"}
              </Button>
            </Form>
          ) : (
            <p>Veuillez sélectionner un restaurant à modifier.</p>
          )}
        </Tab>

        <Tab eventKey="list" title="Liste des Restaurants">
          <h3 className="mt-3">Liste des Restaurants</h3>
          {isLoading ? (
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Chargement...</span>
            </Spinner>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Adresse</th>
                  <th>Ville</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Partenaire</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((restaurant) => (
                  <tr key={restaurant.id}>
                    <td>{restaurant.name}</td>
                    <td>{restaurant.adresse}</td>
                    <td>{restaurant.city}</td>
                    <td>{restaurant.contact}</td>
                    <td>{restaurant.email}</td>
                    <td>{restaurant.isPartner ? "Oui" : "Non"}</td>
                    <td>
                      <Button variant="warning" size="sm" onClick={() => handleEditRestaurant(restaurant)}>
                        Modifier
                      </Button>{" "}
                      <Button variant="danger" size="sm" onClick={() => handleDeleteRestaurant(restaurant.id)}>
                        Supprimer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tab>

        <Tab eventKey="users" title="Liste des Utilisateurs">
          <h3 className="mt-3">Liste des Utilisateurs</h3>
          <div className="mb-3">
            <p>Nombre total d'utilisateurs : <strong>{totalUsers}</strong></p>
            <p>Utilisateurs avec email : <strong>{emailUsers}</strong></p>
            <p>Utilisateurs invités (guest) : <strong>{guestUsers}</strong></p>
          </div>
          {isLoading ? (
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Chargement...</span>
            </Spinner>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Email</th>
                  <th>Nom</th>
                  <th>Rôle</th>
                  <th>Type</th>
                  <th>Collection</th>
                  <th>Restaurant Associé</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersRestau.map((user) => (
                  <tr key={`${user.id}-${user.collection}`}>
                    <td>{user.id}</td>
                    <td>{user.email || "N/A"}</td>
                    <td>{user.name || "N/A"}</td>
                    <td>{user.role || "N/A"}</td>
                    <td>{user.email && user.email !== "" && !user.isGuest ? "Email" : "Guest"}</td>
                    <td>{user.collection}</td>
                    <td>
                      {user.restaurantId
                        ? restaurants.find((r) => r.id === user.restaurantId)?.name || "N/A"
                        : "N/A"}
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.collection)}
                      >
                        Supprimer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tab>

        <Tab eventKey="stats" title="Statistiques">
          <h3 className="mt-3">Statistiques par Restaurant</h3>
          <Form.Group className="mb-3">
            <Form.Label>Sélectionner un Restaurant</Form.Label>
            <Form.Control
              as="select"
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
            >
              <option value="">Tous les restaurants</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </Form.Control>
          </Form.Group>

          <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-md">
            <h4>Période</h4>
            <div className="flex items-center gap-4">
              <Button variant="outline-secondary" onClick={handlePreviousPeriod}>
                {"<"}
              </Button>
              <Form.Control
                type="date"
                value={formatDateForComparison(selectedDate)}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="w-auto"
              />
              <Button variant="outline-secondary" onClick={handleNextPeriod}>
                {">"}
              </Button>
              <Form.Control
                as="select"
                value={dateFilterMode}
                onChange={(e) => setDateFilterMode(e.target.value)}
                className="w-auto"
              >
                <option value="day">Jour</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
              </Form.Control>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <StatCard
              icon={<FaMoneyBillWave />}
              title="Ventes Totales"
              value={`${formatPrice(totalSales)} FCFA`}
              subtext={`Période: ${dateFilterMode === "day" ? "Aujourd'hui" : dateFilterMode === "week" ? "Cette semaine" : "Ce mois"}`}
            />
            <StatCard
              icon={<FaShoppingBasket />}
              title="Nombre de Commandes"
              value={filteredOrders.length}
              subtext={`${filteredOrders.length} commande${filteredOrders.length !== 1 ? "s" : ""}`}
            />
            <StatCard
              icon={<FaClock />}
              title="Durée Moyenne"
              value={`${averageDuration} min`}
              subtext="Commandes livrées"
            />
            <StatCard
              icon={<FaTimesCircle />}
              title="Taux d'Annulation"
              value={`${cancellationRate}%`}
              subtext="Commandes annulées"
            />
            <StatCard
              icon={<FaUsers />}
              title="Utilisateurs avec Email"
              value={emailUsers}
              subtext="Comptes enregistrés"
            />
            <StatCard
              icon={<FaUsers />}
              title="Utilisateurs Invités"
              value={guestUsers}
              subtext="Comptes invités"
            />
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h4 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
              <FaChartLine className="mr-2" /> Ventes par Date
            </h4>
            <canvas id="salesChart" ref={chartRef}></canvas>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h4 className="text-lg font-medium text-gray-700 mb-4">Top 5 Articles</h4>
            <ul className="space-y-2">
              {topItems.map(([name, count], index) => (
                <li key={index} className="flex justify-between">
                  <span>{name}</span>
                  <span className="font-semibold">{count} vendu{count > 1 ? "s" : ""}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h4 className="text-lg font-medium text-gray-700 mb-4">Top 5 Quartiers (Revenus)</h4>
            <ul className="space-y-2">
              {topQuartiers.map(([quartier, revenue], index) => (
                <li key={index} className="flex justify-between">
                  <span>{quartier}</span>
                  <span className="font-semibold text-green-600">{formatPrice(revenue)} FCFA</span>
                </li>
              ))}
            </ul>
          </div>
        </Tab>
      </Tabs>
    </Container>
  );
};

const StatCard = ({ icon, title, value, subtext }) => (
  <div className="bg-white p-4 rounded-lg shadow-md flex items-center space-x-4">
    <div className="text-3xl text-gray-600">{icon}</div>
    <div>
      <h4 className="text-lg font-medium text-gray-700">{title}</h4>
      <p className="text-2xl font-bold text-green-600">{value}</p>
      <p className="text-sm text-gray-500">{subtext}</p>
    </div>
  </div>
);

export default SuperAdmin;