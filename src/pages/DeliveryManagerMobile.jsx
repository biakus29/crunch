import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs, orderBy, addDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { FaTruck, FaMapMarkerAlt, FaPhone, FaCheckCircle, FaClock, FaSignOutAlt, FaUser, FaChartLine, FaBox, FaReceipt, FaPlus, FaGasPump, FaWrench, FaTools, FaFileInvoice, FaHandshake } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DeliveryManagerMobile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [deliverers, setDeliverers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'deliverers', 'stats', 'tracking', 'expenses'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [restaurantId, setRestaurantId] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    delivererId: '',
    category: 'fuel',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    supplier: '',
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      if (!authUser) {
        navigate('/login');
        return;
      }

      try {
        // Récupérer les infos utilisateur
        const userDoc = await getDocs(
          query(collection(db, 'usersrestau'), where('email', '==', authUser.email))
        );

        if (userDoc.empty) {
          toast.error('Utilisateur non autorisé');
          await signOut(auth);
          navigate('/login');
          return;
        }

        const userData = userDoc.docs[0].data();
        if (userData.role !== 'delivery_manager') {
          toast.error('Accès réservé aux gestionnaires de livraison');
          await signOut(auth);
          navigate('/login');
          return;
        }

        setUser(userData);
        setRestaurantId(userData.restaurantId);

        // Écouter les commandes du restaurant
        const ordersQuery = query(
          collection(db, 'orders'),
          where('restaurantId', '==', userData.restaurantId),
          orderBy('timestamp', 'desc')
        );

        const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
          const ordersData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setOrders(ordersData);
        });

        // Charger les livreurs
        const deliverersSnap = await getDocs(
          query(
            collection(db, 'deliverers'),
            where('restaurantId', '==', userData.restaurantId),
            orderBy('name')
          )
        );
        setDeliverers(deliverersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        // Charger les dépenses de livraison
        const expensesSnap = await getDocs(
          query(
            collection(db, 'deliveryExpenses'),
            where('restaurantId', '==', userData.restaurantId),
            orderBy('date', 'desc')
          )
        );
        setExpenses(expensesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

        setLoading(false);
        return () => unsubscribeOrders();
      } catch (error) {
        console.error('Erreur:', error);
        toast.error('Erreur de chargement');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const assignDeliverer = async (orderId, delivererName) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        assignedDeliverer: delivererName,
        updatedAt: new Date()
      });
      toast.success('Livreur assigné avec succès');
      setSelectedOrder(null);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'assignation');
    }
  };

  const handleCreateExpense = async () => {
    try {
      if (!expenseForm.delivererId || !expenseForm.amount || !expenseForm.description) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      const deliverer = deliverers.find((d) => d.id === expenseForm.delivererId);
      const expenseData = {
        ...expenseForm,
        delivererName: deliverer?.name || '',
        amount: parseFloat(expenseForm.amount),
        date: new Date(expenseForm.date),
        restaurantId: restaurantId,
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'deliveryExpenses'), expenseData);
      toast.success('Dépense enregistrée avec succès');
      
      // Recharger les dépenses
      const expensesSnap = await getDocs(
        query(
          collection(db, 'deliveryExpenses'),
          where('restaurantId', '==', restaurantId),
          orderBy('date', 'desc')
        )
      );
      setExpenses(expensesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      
      // Réinitialiser le formulaire
      setExpenseForm({
        delivererId: '',
        category: 'fuel',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        supplier: '',
      });
      setShowExpenseModal(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const EXPENSE_CATEGORIES = [
    { value: 'fuel', label: '⛽ Carburant', color: 'orange' },
    { value: 'maintenance', label: '🔧 Entretien', color: 'blue' },
    { value: 'repair', label: '🛠️ Réparation', color: 'red' },
    { value: 'other', label: '📦 Divers', color: 'purple' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      delivering: 'bg-orange-100 text-orange-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'En attente',
      confirmed: 'Confirmée',
      preparing: 'En préparation',
      ready: 'Prête',
      delivering: 'En livraison',
      delivered: 'Livrée',
      cancelled: 'Annulée'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const activeOrders = orders.filter(o => ['ready', 'delivering'].includes(o.status));
  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.timestamp?.seconds * 1000);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });
  // Normaliser les statuts
  const normalizeStatus = (status) => {
    const statusMap = {
      'en_livraison': 'delivering',
      'livree': 'delivered',
      'delivering': 'delivering',
      'delivered': 'delivered'
    };
    return statusMap[status] || status;
  };

  const deliveredToday = todayOrders.filter(o => 
    normalizeStatus(o.status) === 'delivered' &&
    o.assignedDeliverer && 
    o.assignedDeliverer !== 'Non assigné' &&
    o.assignedDeliverer.trim() !== ''
  ).length;
  const totalDeliveryFees = todayOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <ToastContainer position="top-center" autoClose={3000} />

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-full">
                <FaTruck className="text-2xl" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Gestion Livraisons</h1>
                <p className="text-sm text-blue-100">{user?.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate('/partner-deliveries', { 
                  state: { 
                    restaurantId: restaurantId,
                    fromDeliveryManager: true 
                  } 
                })}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition"
                title="Dashboard Partenaires"
              >
                <FaHandshake className="text-xl" />
              </button>
              <button
                onClick={handleLogout}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition"
                title="Déconnexion"
              >
                <FaSignOutAlt className="text-xl" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-orange-600">{activeOrders.length}</div>
            <div className="text-xs text-gray-600">En cours</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-green-600">{deliveredToday}</div>
            <div className="text-xs text-gray-600">Livrées</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl font-bold text-blue-600">{deliverers.filter(d => d.active).length}</div>
            <div className="text-xs text-gray-600">Livreurs actifs</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-2 px-2 rounded-lg font-medium transition text-sm ${
              activeTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow'
            }`}
          >
            <FaBox className="inline mr-1" />
            Commandes
          </button>
          <button
            onClick={() => setActiveTab('tracking')}
            className={`py-2 px-2 rounded-lg font-medium transition text-sm ${
              activeTab === 'tracking' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow'
            }`}
          >
            <FaClock className="inline mr-1" />
            Suivi
          </button>
          <button
            onClick={() => setActiveTab('deliverers')}
            className={`py-2 px-2 rounded-lg font-medium transition text-sm ${
              activeTab === 'deliverers' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow'
            }`}
          >
            <FaUser className="inline mr-1" />
            Livreurs
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`py-2 px-2 rounded-lg font-medium transition text-sm ${
              activeTab === 'expenses' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow'
            }`}
          >
            <FaReceipt className="inline mr-1" />
            Dépenses
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-2 rounded-lg font-medium transition text-sm ${
              activeTab === 'stats' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow'
            }`}
          >
            <FaChartLine className="inline mr-1" />
            Stats
          </button>
        </div>

        {/* Contenu selon l'onglet */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-800 mb-3">
              Commandes à livrer ({activeOrders.length})
            </h2>
            {activeOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      #{order.id.slice(-6).toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-start text-sm">
                    <FaMapMarkerAlt className="text-red-500 mt-1 mr-2 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900">{order.address?.area || 'Zone non spécifiée'}</div>
                    </div>
                  </div>
                  <div className="flex items-center text-sm">
                    <FaPhone className="text-blue-500 mr-2" />
                    <span className="text-gray-700">{order.contact?.phone}</span>
                  </div>
                  {order.assignedDeliverer && (
                    <div className="flex items-center text-sm">
                      <FaTruck className="text-green-500 mr-2" />
                      <span className="font-medium text-green-700">{order.assignedDeliverer}</span>
                    </div>
                  )}
                </div>

                {!order.assignedDeliverer && (
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Assigner un livreur
                  </button>
                )}
              </div>
            ))}
            {activeOrders.length === 0 && (
              <div className="bg-white rounded-lg p-8 text-center shadow">
                <FaCheckCircle className="mx-auto text-5xl text-green-300 mb-4" />
                <p className="text-gray-500">Toutes les commandes sont livrées !</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tracking' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-800 mb-3">
              Suivi des livraisons en cours
            </h2>
            {orders.filter(o => 
              normalizeStatus(o.status) === 'delivering' && 
              o.assignedDeliverer && 
              o.assignedDeliverer !== 'Non assigné' &&
              o.assignedDeliverer.trim() !== ''
            ).map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-bold text-gray-900">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        En livraison
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      <FaMapMarkerAlt className="inline mr-1" />
                      {order.address?.area}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <FaTruck className="inline mr-1" />
                      Livreur: <span className="font-medium">{order.assignedDeliverer || 'Non assigné'}</span>
                    </div>
                    {order.deliveryStartedAt && (
                      <div className="flex items-center space-x-4 mt-3">
                        <div className="flex items-center text-sm">
                          <FaClock className="text-orange-500 mr-2" />
                          <span className="font-bold text-orange-600">
                            {Math.round((new Date() - order.deliveryStartedAt.toDate()) / 1000 / 60)} min
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Démarré à {order.deliveryStartedAt.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )}
                  </div>
                  {order.deliveryFee && (
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {order.deliveryFee.toLocaleString()} FCFA
                      </div>
                    </div>
                  )}
                </div>
                {order.contact?.phone && (
                  <a
                    href={`tel:${order.contact.phone}`}
                    className="flex items-center justify-center space-x-2 bg-blue-50 text-blue-600 py-2 px-4 rounded-lg hover:bg-blue-100 transition"
                  >
                    <FaPhone />
                    <span>Appeler le client</span>
                  </a>
                )}
              </div>
            ))}
            {orders.filter(o => 
              normalizeStatus(o.status) === 'delivering' && 
              o.assignedDeliverer && 
              o.assignedDeliverer !== 'Non assigné' &&
              o.assignedDeliverer.trim() !== ''
            ).length === 0 && (
              <div className="bg-white rounded-lg p-8 text-center shadow">
                <FaTruck className="mx-auto text-5xl text-gray-300 mb-4" />
                <p className="text-gray-500">Aucune livraison en cours</p>
              </div>
            )}
            
            {/* Livraisons livrées aujourd'hui avec temps */}
            <h2 className="text-lg font-bold text-gray-800 mb-3 mt-6">
              Livrées aujourd'hui ({orders.filter(o => {
                if (normalizeStatus(o.status) !== 'delivered') return false;
                if (!o.assignedDeliverer || o.assignedDeliverer === 'Non assigné' || o.assignedDeliverer.trim() === '') return false;
                const completedDate = o.deliveryCompletedAt ? o.deliveryCompletedAt.toDate() : (o.updatedAt ? o.updatedAt.toDate() : null);
                if (!completedDate) return false;
                return completedDate.toDateString() === new Date().toDateString();
              }).length})
            </h2>
            {orders
              .filter(o => {
                if (normalizeStatus(o.status) !== 'delivered') return false;
                if (!o.assignedDeliverer || o.assignedDeliverer === 'Non assigné' || o.assignedDeliverer.trim() === '') return false;
                const completedDate = o.deliveryCompletedAt ? o.deliveryCompletedAt.toDate() : (o.updatedAt ? o.updatedAt.toDate() : null);
                if (!completedDate) return false;
                return completedDate.toDateString() === new Date().toDateString();
              })
              .sort((a, b) => {
                const dateA = a.deliveryCompletedAt ? a.deliveryCompletedAt.toDate() : (a.updatedAt ? a.updatedAt.toDate() : new Date(0));
                const dateB = b.deliveryCompletedAt ? b.deliveryCompletedAt.toDate() : (b.updatedAt ? b.updatedAt.toDate() : new Date(0));
                return dateB - dateA;
              })
              .slice(0, 10)
              .map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-gray-900">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Livrée
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <FaTruck className="inline mr-1" />
                      {order.assignedDeliverer}
                    </div>
                    <div className="text-xs text-gray-500">
                      {order.address?.area}
                    </div>
                  </div>
                  <div className="text-right">
                    {order.deliveryDurationMinutes && (
                      <div className="flex items-center text-sm font-bold text-orange-600 mb-1">
                        <FaClock className="mr-1" />
                        {order.deliveryDurationMinutes} min
                      </div>
                    )}
                    <div className="text-sm font-bold text-green-600">
                      {order.deliveryFee?.toLocaleString() || 0} FCFA
                    </div>
                    <div className="text-xs text-gray-500">
                      {order.deliveryCompletedAt?.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'deliverers' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-800 mb-3">
              Livreurs ({deliverers.length})
            </h2>
            {deliverers.map((deliverer) => (
              <div key={deliverer.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      deliverer.active ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <FaUser className={deliverer.active ? 'text-green-600' : 'text-gray-400'} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{deliverer.name}</div>
                      <div className="text-sm text-gray-500">{deliverer.phone}</div>
                      <div className="text-xs text-gray-400">
                        {deliverer.vehicleType === 'moto' ? '🏍️ Moto' : '🚗 Voiture'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      deliverer.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {deliverer.active ? 'Actif' : 'Inactif'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {deliverer.totalDeliveries || 0} livraisons
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">
                Dépenses de Livraison ({expenses.length})
              </h2>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
              >
                <FaPlus className="mr-2" /> Nouvelle
              </button>
            </div>

            {/* Statistiques des dépenses */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-lg p-4 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-gray-900">
                      {expenses.reduce((sum, e) => sum + (e.amount || 0), 0).toLocaleString()} FCFA
                    </p>
                  </div>
                  <FaReceipt className="text-2xl text-gray-400" />
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Ce mois</p>
                    <p className="text-lg font-bold text-blue-600">
                      {expenses.filter(e => {
                        const expenseDate = e.date?.toDate ? e.date.toDate() : new Date(e.date);
                        const now = new Date();
                        return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
                      }).reduce((sum, e) => sum + (e.amount || 0), 0).toLocaleString()} FCFA
                    </p>
                  </div>
                  <FaGasPump className="text-2xl text-orange-400" />
                </div>
              </div>
            </div>

            {/* Liste des dépenses */}
            {expenses.slice(0, 20).map((expense) => {
              const category = EXPENSE_CATEGORIES.find((c) => c.value === expense.category);
              return (
                <div key={expense.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${category?.color}-100 text-${category?.color}-800`}>
                          {category?.label || expense.category}
                        </span>
                        <span className="text-xs text-gray-500">
                          {expense.date?.toDate
                            ? expense.date.toDate().toLocaleDateString('fr-FR')
                            : new Date(expense.date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {expense.description}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <FaUser className="mr-1" />
                        {expense.delivererName}
                      </div>
                      {expense.supplier && (
                        <div className="text-xs text-gray-500 mt-1">
                          Fournisseur: {expense.supplier}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {expense.amount?.toLocaleString() || 0} FCFA
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {expenses.length === 0 && (
              <div className="bg-white rounded-lg p-8 text-center shadow">
                <FaReceipt className="mx-auto text-5xl text-gray-300 mb-4" />
                <p className="text-gray-500">Aucune dépense enregistrée</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Statistiques du jour</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Total commandes</span>
                  <span className="font-bold text-gray-900">{todayOrders.length}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Livrées</span>
                  <span className="font-bold text-green-600">{deliveredToday}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">En cours</span>
                  <span className="font-bold text-orange-600">{activeOrders.length}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Frais de livraison total</span>
                  <span className="font-bold text-blue-600">{totalDeliveryFees.toLocaleString()} FCFA</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Performance livreurs</h3>
              <div className="space-y-3">
                {deliverers
                  .filter(d => d.active)
                  .sort((a, b) => (b.totalDeliveries || 0) - (a.totalDeliveries || 0))
                  .slice(0, 5)
                  .map((deliverer, index) => (
                    <div key={deliverer.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                          {index + 1}
                        </div>
                        <span className="font-medium text-gray-900">{deliverer.name}</span>
                      </div>
                      <span className="font-bold text-gray-700">{deliverer.totalDeliveries || 0}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal assignation livreur */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Assigner un livreur</h3>
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">Commande #{selectedOrder.id.slice(-6).toUpperCase()}</div>
                <div className="text-sm font-medium text-gray-900">{selectedOrder.address?.area}</div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {deliverers.filter(d => d.active).map((deliverer) => (
                  <button
                    key={deliverer.id}
                    onClick={() => assignDeliverer(selectedOrder.id, deliverer.name)}
                    className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <FaUser className="text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{deliverer.name}</div>
                        <div className="text-sm text-gray-500">{deliverer.vehicleType === 'moto' ? '🏍️ Moto' : '🚗 Voiture'}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {deliverer.totalDeliveries || 0} livraisons
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full mt-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal création dépense */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setShowExpenseModal(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Nouvelle Dépense</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Livreur *</label>
                  <select
                    value={expenseForm.delivererId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, delivererId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un livreur</option>
                    {deliverers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA) *</label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 5000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <input
                    type="text"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Plein d'essence"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                  <input
                    type="text"
                    value={expenseForm.supplier}
                    onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Station Total"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateExpense}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryManagerMobile;
