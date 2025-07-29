import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, setDoc, query, where, orderBy, limit } from 'firebase/firestore';
import logo from '../image/logo.png';
import { useCart } from '../context/cartcontext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ANIMATION_VARIANTS, 
  AnimatedComponents, 
  FoodAnimations, 
  CardAnimations,
  useScrollTrigger 
} from '../utils/animationSystem';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Edit, 
  Save, 
  X, 
  Plus, 
  Trash2, 
  Star, 
  Clock, 
  Package, 
  ShoppingCart, 
  Home, 
  LogOut,
  Check,
  AlertCircle,
  Info,
  Heart,
  Settings,
  CreditCard,
  Bell,
  ArrowLeft,
  Camera,
  Shield,
  Award,
  Gift,
  TrendingUp,
  Sparkles
} from 'lucide-react';

const Profile = () => {
  const [user, setUser] = useState(null); // Peut être un utilisateur Firebase ou un objet invité
  const [isGuest, setIsGuest] = useState(false); // Indique si l'utilisateur est un invité
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [addresses, setAddresses] = useState([]);
  const [addressForm, setAddressForm] = useState({
    nickname: 'Home',
    city: 'Yaoundé',
    area: '',
    completeAddress: '',
    instructions: '',
    phone: '',
  });
  const [addressErrors, setAddressErrors] = useState({});
  const [userPoints, setUserPoints] = useState(0);
  const [pointsTransactions, setPointsTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();
  const { cartItems } = useCart();
  const scrollAnimation = useScrollTrigger();

  // Validation des données d'adresse
  const validateAddress = useCallback((data) => {
    const errors = {};
    if (!data.city) errors.city = 'Ville requise';
    if (!data.area) errors.area = 'Quartier requis';
    if (!data.completeAddress) errors.completeAddress = 'Adresse complète requise';
    if (!data.phone) errors.phone = 'Téléphone requis';
    else if (!/^\+?[0-9]{9,15}$/.test(data.phone)) errors.phone = 'Numéro invalide (9-15 chiffres)';
    return errors;
  }, []);

  // Actions Firestore
  const firestoreActions = {
    loadAddresses: async (userId) => {
      const snapshot = await getDocs(collection(db, `usersrestau/${userId}/addresses`));
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
    saveAddress: async (userId, address, isEdit = false) => {
      if (isEdit) {
        await updateDoc(doc(db, `usersrestau/${userId}/addresses/${address.id}`), address);
      } else {
        const docRef = await addDoc(collection(db, `usersrestau/${userId}/addresses`), {
          ...address,
          default: addresses.length === 0,
        });
        return docRef.id;
      }
    },
    deleteAddress: async (userId, addressId) => {
      await deleteDoc(doc(db, `usersrestau/${userId}/addresses/${addressId}`));
    },
    setDefaultAddress: async (userId, addressId) => {
      const addressesRef = collection(db, `usersrestau/${userId}/addresses`);
      const snapshot = await getDocs(addressesRef);
      snapshot.forEach(async (doc) => {
        await updateDoc(doc.ref, { default: doc.id === addressId });
      });
    },
    loadOrders: async (userId) => {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(3)
      );
      const snapshot = await getDocs(ordersQuery);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
  };

  // Récupérer les données utilisateur, adresses, points et commandes
  const fetchUserData = useCallback(async (uid, currentUserEmail = '', isGuestUser = false) => {
    try {
      setLoading(true);
      const userDocRef = doc(db, 'usersrestau', uid);
      const userDoc = await getDoc(userDocRef);

      console.log('Profile: Chargement userDoc pour uid =', uid);

      if (!userDoc.exists()) {
        console.log('Profile: Création nouveau document utilisateur');
        await setDoc(userDocRef, {
          firstName: '',
          lastName: '',
          email: currentUserEmail || '',
          phone: '',
          points: 0,
          createdAt: new Date().toISOString(),
          isGuest: isGuestUser,
        });
        setFormData({
          firstName: '',
          lastName: '',
          email: currentUserEmail || '',
          phone: '',
        });
        setUserPoints(0);
        setIsGuest(isGuestUser);
      } else {
        const userData = userDoc.data();
        console.log('Profile: userData =', userData);
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || currentUserEmail || '',
          phone: userData.phone || '',
        });
        const points = typeof userData.points === 'number' ? userData.points : 0;
        setUserPoints(points);
        setIsGuest(!!userData.isGuest);
        console.log('Profile: userPoints =', points);
      }

      const loadedAddresses = await firestoreActions.loadAddresses(uid);
      setAddresses(loadedAddresses);
      console.log('Profile: Adresses chargées =', loadedAddresses);

      try {
        const transactionsQuery = query(
          collection(db, 'pointsTransactions'),
          where('userId', '==', uid),
          orderBy('timestamp', 'desc'),
          limit(5)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        const transactions = transactionsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPointsTransactions(transactions);
        console.log('Profile: Transactions de points =', transactions);
      } catch (transactionError) {
        console.warn('Erreur lors de la récupération des transactions de points:', transactionError);
        setPointsTransactions([]);
      }

      try {
        const loadedOrders = await firestoreActions.loadOrders(uid);
        setOrders(loadedOrders);
        console.log('Profile: Commandes chargées =', loadedOrders);
      } catch (orderError) {
        console.warn('Erreur lors de la récupération des commandes:', orderError);
        setOrders([]);
      }
    } catch (err) {
      console.error('Erreur dans fetchUserData:', err);
      if (err.code === 'failed-precondition') {
        setError('Configuration de la base de données requise. Veuillez contacter le support.');
      } else if (err.code === 'permission-denied') {
        setError('Vous n’avez pas les autorisations nécessaires.');
      } else {
        setError('Erreur lors de la récupération des données.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Vérifier l'état d'authentification ou utilisateur invité
  useEffect(() => {
    const checkUser = async () => {
      // Vérifier d'abord l'utilisateur Firebase
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          // Utilisateur authentifié via Firebase
          setUser(currentUser);
          await fetchUserData(currentUser.uid, currentUser.email, false);
        } else {
          // Aucun utilisateur Firebase, vérifier utilisateur invité
          const guestUserId = localStorage.getItem('guestUserId');
          const guestPhone = localStorage.getItem('guestPhone');

          if (guestUserId || guestPhone) {
            try {
              setLoading(true);
              let guestDocRef;
              let guestDoc;

              if (guestUserId && guestUserId.startsWith('guest-')) {
                // Rechercher par UID
                guestDocRef = doc(db, 'usersrestau', guestUserId);
                guestDoc = await getDoc(guestDocRef);
              } else if (guestPhone) {
                // Rechercher par numéro de téléphone
                const usersQuery = query(
                  collection(db, 'usersrestau'),
                  where('phone', '==', guestPhone),
                  where('isGuest', '==', true)
                );
                const querySnapshot = await getDocs(usersQuery);
                guestDoc = querySnapshot.docs[0];
                guestDocRef = guestDoc?.ref;
              }

              if (guestDoc?.exists()) {
                const guestData = guestDoc.data();
                console.log('Profile: Utilisateur invité trouvé =', guestData);
                setUser({
                  uid: guestDoc.id,
                  email: guestData.email || '',
                  phone: guestData.phone || '',
                });
                await fetchUserData(guestDoc.id, guestData.email || '', true);
              } else {
                console.log('Profile: Aucun utilisateur invité trouvé');
                navigate('/login');
              }
            } catch (err) {
              console.error('Erreur lors de la vérification de l’utilisateur invité:', err);
              setError('Erreur lors de la vérification de l’utilisateur invité');
              navigate('/login');
            } finally {
              setLoading(false);
            }
          } else {
            // Aucun utilisateur (ni Firebase ni invité)
            navigate('/login');
          }
        }
      });

      return () => unsubscribe();
    };

    checkUser();
  }, [navigate, fetchUserData]);

  // Gestion des changements de formulaire utilisateur
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Gestion des changements de formulaire d'adresse
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setAddressForm((prev) => ({ ...prev, [name]: value }));
    setAddressErrors((prev) => ({ ...prev, [name]: '' }));
  };

  // Ajouter ou éditer une adresse
  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateAddress(addressForm);
    if (Object.keys(validationErrors).length > 0) {
      setAddressErrors(validationErrors);
      return;
    }
    try {
      setLoading(true);
      await firestoreActions.saveAddress(
        user.uid,
        { ...addressForm, ...(editingAddress ? { id: editingAddress.id } : {}) },
        !!editingAddress
      );
      const updatedAddresses = await firestoreActions.loadAddresses(user.uid);
      setAddresses(updatedAddresses);
      setShowAddressModal(false);
      resetAddressForm();
      setSuccessMessage('Adresse enregistrée avec succès !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Erreur lors de l’enregistrement de l’adresse');
    } finally {
      setLoading(false);
    }
  };

  // Supprimer une adresse
  const handleDeleteAddress = async (addressId) => {
    if (window.confirm('Voulez-vous vraiment supprimer cette adresse ?')) {
      try {
        setLoading(true);
        await firestoreActions.deleteAddress(user.uid, addressId);
        const updatedAddresses = addresses.filter((a) => a.id !== addressId);
        setAddresses(updatedAddresses);
        setSuccessMessage('Adresse supprimée avec succès !');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Erreur lors de la suppression de l’adresse');
      } finally {
        setLoading(false);
      }
    }
  };

  // Définir une adresse par défaut
  const handleSetDefault = async (addressId) => {
    try {
      setLoading(true);
      await firestoreActions.setDefaultAddress(user.uid, addressId);
      const updatedAddresses = await firestoreActions.loadAddresses(user.uid);
      setAddresses(updatedAddresses);
      setSuccessMessage('Adresse par défaut mise à jour !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Erreur lors de la mise à jour de l’adresse par défaut');
    } finally {
      setLoading(false);
    }
  };

  // Éditer une adresse
  const handleEditAddress = (address) => {
    setEditingAddress(address);
    setAddressForm({
      nickname: address.nickname,
      city: address.city,
      area: address.area,
      completeAddress: address.completeAddress,
      instructions: address.instructions || '',
      phone: address.phone || '',
    });
    setShowAddressModal(true);
  };

  // Réinitialiser le formulaire d'adresse
  const resetAddressForm = () => {
    setAddressForm({
      nickname: 'Home',
      city: 'Yaoundé',
      area: '',
      completeAddress: '',
      instructions: '',
      phone: '',
    });
    setAddressErrors({});
    setEditingAddress(null);
  };

  // Sauvegarder le profil
  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userDocRef = doc(db, 'usersrestau', user.uid);
      await updateDoc(userDocRef, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        updatedAt: new Date().toISOString(),
        isGuest: isGuest, // Conserver le statut d'invité
      });
      setSuccessMessage('Profil mis à jour avec succès !');
      setEditMode(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  // Déconnexion (pour utilisateurs Firebase ou invités)
  const handleSignOut = async () => {
    try {
      if (isGuest) {
        // Pour les invités, nettoyer localStorage
        localStorage.removeItem('guestUserId');
        localStorage.removeItem('guestPhone');
        navigate('/login');
      } else {
        // Pour les utilisateurs Firebase, déconnexion classique
        await signOut(auth);
        navigate('/login');
      }
    } catch (err) {
      setError('Erreur lors de la déconnexion');
    }
  };

  // Formatter les dates
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Formatter les prix
  const formatPrice = (price) => {
    return Number(price).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) + ' Fcfa';
  };

  if (loading) {
    return (
      <AnimatedComponents.AnimatedPage className="min-h-screen bg-gray-100">
        <div className="flex items-center justify-center h-screen">
          <AnimatedComponents.AnimatedLoader type="spinner" size="large" color="green" />
        </div>
      </AnimatedComponents.AnimatedPage>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center bg-red-100 text-red-700 rounded-lg m-4">
        {error}{' '}
        <button onClick={() => window.location.reload()} className="underline text-red-900">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <AnimatedComponents.AnimatedPage className="min-h-screen bg-gray-100 pb-16">
      {/* En-tête */}
      <motion.header
        {...ANIMATION_VARIANTS.fadeInDown}
        className="bg-white shadow sticky top-0 z-10"
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <AnimatedComponents.AnimatedImage
              src={logo}
              alt="Logo"
              className="h-8"
              hoverZoom={false}
            />
            <span className="font-bold text-green-600 text-lg">MANGE d'ABORD</span>
          </Link>
          <motion.button
            {...ANIMATION_VARIANTS.buttonPress}
            onClick={() => (editMode ? setEditMode(false) : navigate(-1))}
            className="text-gray-700 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.header>

              {/* Photo de profil et nom */}
        <motion.div
          {...ANIMATION_VARIANTS.fadeInUp}
          className="bg-white py-6 text-center border-b"
        >
          <div className="relative inline-block">
            {user?.photoURL ? (
              <AnimatedComponents.AnimatedImage
                src={user.photoURL}
                alt="Profil"
                className="w-24 h-24 rounded-full border-2 border-green-600 object-cover"
                hoverZoom={false}
              />
            ) : (
              <motion.div
                className="w-24 h-24 rounded-full border-2 border-green-600 bg-gray-200 flex items-center justify-center"
                whileHover={{ scale: 1.05 }}
              >
                <User className="w-12 h-12 text-gray-500" />
              </motion.div>
            )}
            {editMode && !isGuest && (
              <motion.button
                {...ANIMATION_VARIANTS.buttonPress}
                className="absolute bottom-0 right-0 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center"
              >
                <Camera className="w-4 h-4" />
              </motion.button>
            )}
          </div>
          <motion.h5
            className="mt-3 text-xl font-bold"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {formData.firstName} {formData.lastName}
          </motion.h5>
          <motion.p
            className="text-sm text-gray-500"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {formData.email || formData.phone || 'Invité'}
          </motion.p>
          {isGuest && (
            <motion.p
              className="text-xs text-gray-500 mt-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Compte simple - <Link to="/logins" className="text-green-600 hover:underline">Créer un compte complet</Link>
            </motion.p>
          )}
        </motion.div>

      {/* Contenu principal avec onglets */}
      <motion.div
        {...scrollAnimation}
        className="container mx-auto px-4 mt-4"
      >
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-center"
            >
              {successMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Onglets */}
        <motion.div
          className="bg-white rounded-t-lg shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex border-b">
            {[
              { id: 'profile', label: 'Profil', icon: User },
              { id: 'addresses', label: 'Adresses', icon: MapPin },
              { id: 'points', label: 'Points', icon: Star },
              { id: 'orders', label: 'Commandes', icon: Package },
            ].map((tab, index) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 text-base font-semibold text-center transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-green-100 border-b-4 border-green-600 text-green-700'
                    : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                } flex items-center justify-center space-x-2`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <tab.icon className="w-5 h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Contenu des onglets */}
          <div className="p-4">
            {/* Onglet Profil */}
            {activeTab === 'profile' && (
              <div>
                {!editMode ? (
                  <div className="divide-y">
                    <div className="p-4">
                      <p className="text-xs text-gray-500">Prénom</p>
                      <p className="text-sm">{formData.firstName || 'Non renseigné'}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-gray-500">Nom</p>
                      <p className="text-sm">{formData.lastName || 'Non renseigné'}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-gray-500">Téléphone</p>
                      <p className="text-sm">{formData.phone || 'Non renseigné'}</p>
                    </div>
                    <div className="p-4">
                      <button
                        onClick={() => setEditMode(true)}
                        className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                      >
                        <i className="fas fa-edit mr-2"></i> Modifier le profil
                      </button>
                    </div>
                  </div>
                ) : (
                  <form>
                    <div className="divide-y">
                      <div className="p-4">
                        <label className="block text-xs text-gray-500 mb-1">Prénom</label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="p-4">
                        <label className="block text-xs text-gray-500 mb-1">Nom</label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="p-4">
                        <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="p-4">
                        <label className="block text-xs text-gray-500 mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          className="w-full p-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                          disabled
                        />
                      </div>
                    </div>
                    <div className="p-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditMode(false)}
                        className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={loading}
                        className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-green-400"
                      >
                        {loading ? (
                          <span>
                            <i className="fas fa-spinner fa-spin mr-2"></i> Enregistrement...
                          </span>
                        ) : (
                          <span>
                            <i className="fas fa-save mr-2"></i> Enregistrer
                          </span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Onglet Adresses */}
            {activeTab === 'addresses' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h6 className="font-bold text-lg">Mes adresses</h6>
                  <button
                    onClick={() => setShowAddressModal(true)}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition text-sm"
                  >
                    <i className="fas fa-plus mr-1"></i> Ajouter
                  </button>
                </div>
                {addresses.length > 0 ? (
                  addresses.map((address) => (
                    <div key={address.id} className="p-4 border-b last:border-b-0 flex items-start">
                      <input
                        type="radio"
                        checked={address.default}
                        onChange={() => handleSetDefault(address.id)}
                        className="mt-1 h-5 w-5 text-green-600"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center">
                          <h6 className="font-semibold">{address.nickname}</h6>
                          <button
                            onClick={() => handleEditAddress(address)}
                            className="ml-2 text-green-600 hover:text-green-800"
                          >
                            <i className="fas fa-pen-to-square"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(address.id)}
                            className="ml-2 text-red-600 hover:text-red-800"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                          {address.default && (
                            <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                              Par défaut
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {address.city} - {address.area}
                        </p>
                        <p className="text-sm text-gray-600">{address.completeAddress}</p>
                        <p className="text-sm text-gray-600">Téléphone: {address.phone}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">Aucune adresse enregistrée</div>
                )}
              </div>
            )}

            {/* Onglet Points de fidélité */}
            {activeTab === 'points' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <motion.h6
                  className="font-bold text-lg mb-4 flex items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Star className="w-6 h-6 text-green-600 mr-2" />
                  Points de fidélité
                </motion.h6>
                
                <motion.div
                  className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg mb-4 border border-green-200"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-green-800">Solde actuel</p>
                    <motion.div
                      className="flex items-center space-x-1"
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Star className="w-4 h-4 text-green-600" />
                      <Sparkles className="w-3 h-3 text-green-500" />
                    </motion.div>
                  </div>
                  <motion.div
                    className="text-2xl font-bold text-green-600 mb-2"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      color: ["#059669", "#10B981", "#059669"]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {userPoints} points
                  </motion.div>
                  <p className="text-xs text-green-700">
                    {userPoints > 0
                      ? `Équivaut à ${userPoints * 100} Fcfa pour vos prochaines commandes`
                      : 'Effectuez des commandes de 5000 Fcfa ou plus pour gagner des points !'}
                  </p>
                </motion.div>
                <div className="bg-green-50 p-3 rounded-lg mb-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold">Comment fonctionnent les points ?</p>
                    <button
                      className="text-green-600 hover:text-green-800"
                      onClick={() => alert(
                        'Gagnez des points sur chaque commande de 5000 Fcfa ou plus !\n' +
                        '- Première commande : 10 % du total (ex. : 10 000 Fcfa = 10 points).\n' +
                        '- Commandes suivantes : 5 % du total (ex. : 10 000 Fcfa = 5 points).\n' +
                        '- 1 point = 100 Fcfa.\n' +
                        '- Utilisez vos points pour payer une commande (frais de livraison annulés).\n' +
                        '- Les points sont validés par un administrateur après confirmation de la commande.'
                      )}
                    >
                      <i className="fas fa-info-circle"></i>
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Gagnez des points sur les commandes de 5000 Fcfa ou plus. Première commande : 10 %. Commandes suivantes : 5 %. 1 point = 100 Fcfa.
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Utilisez vos points pour payer vos commandes (frais de livraison annulés après validation admin).
                  </p>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <h6 className="font-semibold text-sm">Dernières transactions</h6>
                  <Link to="/points-history" className="text-green-600 text-sm hover:underline">
                    Voir tout
                  </Link>
                </div>
                {pointsTransactions.length > 0 ? (
                  pointsTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex justify-between items-center p-2 border-b last:border-b-0"
                    >
                      <div>
                        <p className={`text-sm ${transaction.type === 'points_grant' ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.type === 'points_grant'
                            ? `+${transaction.pointsAmount} points`
                            : `-${transaction.pointsAmount} points`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {transaction.message} ({transaction.status})
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(transaction.timestamp)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Aucune transaction récente. Commandez pour gagner des points !</p>
                )}
              </motion.div>
            )}

            {/* Onglet Commandes */}
            {activeTab === 'orders' && (
              <div>
                <h6 className="font-bold text-lg mb-2">Mes commandes</h6>
                {orders.length > 0 ? (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-semibold">Commande #{order.id.slice(0, 8)}</p>
                            <p className="text-xs text-gray-500">{formatDate(order.timestamp)}</p>
                          </div>
                          <p className="text-sm font-semibold text-green-600">{formatPrice(order.total)}</p>
                        </div>
                        <p className="text-xs text-gray-600 mt-2">
                          Statut :{' '}
                          <span
                            className={`${
                              order.status === 'delivered'
                                ? 'text-green-600'
                                : order.status === 'cancelled'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                            } capitalize`}
                          >
                            {order.status || 'En attente'}
                          </span>
                        </p>
                        <Link
                          to={`/complete_order/${order.id}`}
                          className="mt-2 inline-block text-green-600 hover:underline text-sm"
                        >
                          Voir les détails
                        </Link>
                      </div>
                    ))}
                    <div className="text-center">
                      <Link
                        to="/complete_order"
                        className="inline-block bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition"
                      >
                        <i className="fas fa-shopping-bag mr-2"></i> Voir toutes les commandes
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      Vous n'avez pas encore passé de commande.
                    </p>
                    <Link
                      to="/"
                      className="inline-block bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition"
                    >
                      <i className="fas fa-shopping-cart mr-2"></i> Commencer à commander
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Bouton de déconnexion */}
        <motion.button
          onClick={handleSignOut}
          className="w-full py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition mt-4"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut className="w-4 h-4 mr-2 inline" />
          {isGuest ? 'Quitter le mode invité' : 'Déconnexion'}
        </motion.button>
      </motion.div>

      {/* Modal pour ajouter/éditer une adresse */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h5 className="font-semibold">
                {editingAddress ? 'Modifier l’adresse' : 'Nouvelle adresse'}
              </h5>
              <button
                onClick={() => {
                  setShowAddressModal(false);
                  resetAddressForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddressSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type d’adresse</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Home', 'Work', 'Other'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleAddressChange({ target: { name: 'nickname', value: type } })}
                      className={`p-2 rounded flex items-center justify-center gap-2 ${
                        addressForm.nickname === type
                          ? 'bg-green-100 border-green-600 text-green-600'
                          : 'border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <i
                        className={`fas ${
                          type === 'Home' ? 'fa-house' : type === 'Work' ? 'fa-briefcase' : 'fa-question'
                        }`}
                      ></i>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ville</label>
                <select
                  name="city"
                  value={addressForm.city}
                  onChange={handleAddressChange}
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="Yaoundé">Yaoundé</option>
                  <option value="Douala" disabled>
                    Douala (Indisponible pour le moment)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Quartier</label>
                <input
                  type="text"
                  name="area"
                  value={addressForm.area}
                  onChange={handleAddressChange}
                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    addressErrors.area ? 'border-red-500' : ''
                  }`}
                  placeholder="Votre quartier"
                />
                {addressErrors.area && (
                  <p className="text-red-500 text-xs mt-1">{addressErrors.area}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  name="completeAddress"
                  value={addressForm.completeAddress}
                  onChange={handleAddressChange}
                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    addressErrors.completeAddress ? 'border-red-500' : ''
                  }`}
                  placeholder="Adresse complète"
                />
                {addressErrors.completeAddress && (
                  <p className="text-red-500 text-xs mt-1">{addressErrors.completeAddress}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Instructions</label>
                <input
                  type="text"
                  name="instructions"
                  value={addressForm.instructions}
                  onChange={handleAddressChange}
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Instructions (facultatif)"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
                <input
                  type="tel"
                  name="phone"
                  value={addressForm.phone}
                  onChange={handleAddressChange}
                  className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    addressErrors.phone ? 'border-red-500' : ''
                  }`}
                  placeholder="Ex: +237690123456"
                />
                {addressErrors.phone && (
                  <p className="text-red-500 text-xs mt-1">{addressErrors.phone}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddressModal(false);
                    resetAddressForm();
                  }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-green-400"
                >
                  {loading ? (
                    <span>
                      <i className="fas fa-spinner fa-spin mr-2"></i> Enregistrement...
                    </span>
                  ) : editingAddress ? (
                    'Mettre à jour'
                  ) : (
                    'Enregistrer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Footer */}
      <motion.footer
        {...ANIMATION_VARIANTS.fadeInUp}
        className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg"
      >
        <div className="grid grid-cols-4">
          <Link to="/accueil" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <Home className="w-5 h-5 mx-auto" />
            <span className="block text-xs mt-1">Accueil</span>
          </Link>
          <Link to="/cart" className="relative text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <ShoppingCart className="w-5 h-5 mx-auto" />
            {cartItems.length > 0 && (
              <motion.span
                {...ANIMATION_VARIANTS.scaleIn}
                className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-green-600 rounded-full"
              >
                {cartItems.length}
              </motion.span>
            )}
            <span className="block text-xs mt-1">Panier</span>
          </Link>
          <Link to="/complete_order" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <Package className="w-5 h-5 mx-auto" />
            <span className="block text-xs mt-1">Commandes</span>
          </Link>
          <Link to="/profile" className="text-gray-700 p-2 hover:text-green-600 transition-colors duration-200">
            <User className="w-5 h-5 mx-auto" />
            <span className="block text-xs mt-1">Compte</span>
          </Link>
        </div>
      </motion.footer>
    </AnimatedComponents.AnimatedPage>
  );
};

export default Profile;