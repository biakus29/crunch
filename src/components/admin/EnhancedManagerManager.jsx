import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../../firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
  getDoc
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import {
  FaUsers,
  FaPlus,
  FaEdit,
  FaTrash,
  FaEye,
  FaKey,
  FaEnvelope,
  FaPhone,
  FaBuilding,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaInfoCircle,
  FaSync,
  FaUserCheck,
  FaUserTimes
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { handleFirebaseError, getErrorSuggestions } from '../../utils/firebaseErrorHandler';

const EnhancedManagerManager = ({ currentRestaurantId }) => {
  const [managers, setManagers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'create', 'edit', 'link'
  const [selectedManager, setSelectedManager] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [existingUser, setExistingUser] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    restaurantId: currentRestaurantId || '',
    role: 'manager',
    active: true
  });

  const [linkForm, setLinkForm] = useState({
    email: '',
    password: '',
    restaurantId: currentRestaurantId || ''
  });

  useEffect(() => {
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Charger les managers
      const managersQuery = query(
        collection(db, 'usersrestau'),
        where('role', '==', 'manager'),
        orderBy('createdAt', 'desc')
      );
      const managersSnap = await getDocs(managersQuery);
      setManagers(managersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Charger les restaurants
      const restaurantsQuery = query(
        collection(db, 'restaurants'),
        orderBy('name')
      );
      const restaurantsSnap = await getDocs(restaurantsQuery);
      setRestaurants(restaurantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const checkEmailExists = async (email) => {
    if (!email) {
      setEmailExists(false);
      setExistingUser(null);
      return;
    }

    try {
      setCheckingEmail(true);
      
      // Vérifier dans usersrestau
      const userQuery = query(
        collection(db, 'usersrestau'),
        where('email', '==', email.trim())
      );
      const userSnap = await getDocs(userQuery);
      
      if (!userSnap.empty) {
        const user = userSnap.docs[0].data();
        setEmailExists(true);
        setExistingUser({
          id: userSnap.docs[0].id,
          ...user
        });
      } else {
        setEmailExists(false);
        setExistingUser(null);
      }
    } catch (error) {
      console.error('Erreur vérification email:', error);
      setEmailExists(false);
      setExistingUser(null);
    } finally {
      setCheckingEmail(false);
    }
  };

  const createManager = async () => {
    try {
      if (!form.email || !form.name) {
        toast.error('Email et nom sont requis');
        return;
      }

      // Vérifier si l'email existe déjà
      await checkEmailExists(form.email);
      
      if (emailExists) {
        toast.error('Cet email est déjà utilisé. Utilisez "Lier un compte existant" à la place.');
        return;
      }

      if (!form.password) {
        toast.error('Mot de passe requis pour créer un nouveau compte');
        return;
      }

      // Créer le compte Auth
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const uid = cred.user.uid;

      // Mettre à jour le profil Auth
      await updateProfile(cred.user, {
        displayName: form.name
      });

      // Créer le profil utilisateur
      const userData = {
        name: form.name,
        email: form.email.trim(),
        phone: form.phone || '',
        role: 'manager',
        restaurantId: form.restaurantId,
        uid,
        active: form.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'usersrestau', uid), userData);

      // Créer le restaurant si nécessaire
      if (form.restaurantId) {
        const restaurantData = {
          name: form.name,
          adresse: '',
          city: '',
          contact: form.phone || '',
          uid,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await addDoc(collection(db, 'restaurants'), restaurantData);
      }

      setManagers(prev => [{ id: uid, ...userData }, ...prev]);
      closeModal();
      toast.success('Manager créé avec succès');
      
      // Afficher les informations de connexion
      toast.info(`Email: ${form.email}\nMot de passe: ${form.password}`, {
        autoClose: 10000
      });

    } catch (error) {
      const message = handleFirebaseError(error, toast);
      
      // Afficher des suggestions spécifiques
      if (error.code === 'auth/email-already-in-use') {
        const suggestions = getErrorSuggestions(error);
        toast.info(`Suggestions: ${suggestions.join(', ')}`, {
          autoClose: 8000
        });
      }
    }
  };

  const linkExistingAccount = async () => {
    try {
      if (!linkForm.email || !linkForm.password) {
        toast.error('Email et mot de passe sont requis');
        return;
      }

      // Vérifier les identifiants
      const cred = await signInWithEmailAndPassword(auth, linkForm.email.trim(), linkForm.password);
      const uid = cred.user.uid;

      // Vérifier si l'utilisateur existe déjà dans usersrestau
      const userDoc = await getDoc(doc(db, 'usersrestau', uid));
      
      if (userDoc.exists()) {
        // Mettre à jour le rôle et le restaurant
        await updateDoc(doc(db, 'usersrestau', uid), {
          role: 'manager',
          restaurantId: linkForm.restaurantId,
          active: true,
          updatedAt: serverTimestamp()
        });
        
        toast.success('Compte existant lié avec succès');
      } else {
        // Créer le profil utilisateur
        const userData = {
          name: cred.user.displayName || linkForm.email.split('@')[0],
          email: linkForm.email.trim(),
          phone: '',
          role: 'manager',
          restaurantId: linkForm.restaurantId,
          uid,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, 'usersrestau', uid), userData);
        setManagers(prev => [{ id: uid, ...userData }, ...prev]);
        
        toast.success('Compte existant créé et lié avec succès');
      }

      closeModal();
      await loadData();

    } catch (error) {
      handleFirebaseError(error, toast);
    }
  };

  const updateManager = async () => {
    try {
      if (!selectedManager) return;

      const updateData = {
        name: form.name,
        email: form.email.trim(),
        phone: form.phone || '',
        restaurantId: form.restaurantId,
        active: form.active,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'usersrestau', selectedManager.id), updateData);
      
      setManagers(prev => prev.map(m => 
        m.id === selectedManager.id ? { ...m, ...updateData } : m
      ));
      
      closeModal();
      toast.success('Manager modifié avec succès');

    } catch (error) {
      handleFirebaseError(error, toast);
    }
  };

  const resetPassword = async (manager) => {
    try {
      await sendPasswordResetEmail(auth, manager.email);
      toast.success(`Email de réinitialisation envoyé à ${manager.email}`);
    } catch (error) {
      handleFirebaseError(error, toast);
    }
  };

  const toggleManagerStatus = async (manager) => {
    try {
      const newStatus = !manager.active;
      await updateDoc(doc(db, 'usersrestau', manager.id), {
        active: newStatus,
        updatedAt: serverTimestamp()
      });
      
      setManagers(prev => prev.map(m => 
        m.id === manager.id ? { ...m, active: newStatus } : m
      ));
      
      toast.success(`Manager ${newStatus ? 'activé' : 'désactivé'} avec succès`);
    } catch (error) {
      handleFirebaseError(error, toast);
    }
  };

  const openModal = (type, manager = null) => {
    setModalType(type);
    if (manager) {
      setSelectedManager(manager);
      setForm({
        name: manager.name || '',
        email: manager.email || '',
        phone: manager.phone || '',
        password: '',
        restaurantId: manager.restaurantId || currentRestaurantId || '',
        role: manager.role || 'manager',
        active: manager.active !== false
      });
    } else {
      setForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        restaurantId: currentRestaurantId || '',
        role: 'manager',
        active: true
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedManager(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      restaurantId: currentRestaurantId || '',
      role: 'manager',
      active: true
    });
    setLinkForm({
      email: '',
      password: '',
      restaurantId: currentRestaurantId || ''
    });
    setEmailExists(false);
    setExistingUser(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800">👥 Gestion des Gérants</h3>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Créer et gérer les comptes gérants</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => openModal('create')}
              className="w-full sm:w-auto px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center space-x-2 text-base sm:text-lg"
            >
              <FaPlus />
              <span>Nouveau Gérant</span>
            </button>
            <button
              onClick={() => openModal('link')}
              className="w-full sm:w-auto px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 flex items-center justify-center space-x-2 text-base sm:text-lg"
            >
              <FaUserCheck />
              <span>Lier un Compte</span>
            </button>
          </div>
        </div>
      </div>

      {/* Liste des managers */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-4">📋 Liste des Gérants</h3>
        
        {managers.length === 0 ? (
          <div className="text-center py-8">
            <FaUsers className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">Aucun gérant enregistré</p>
          </div>
        ) : (
          <div className="space-y-3">
            {managers.map(manager => (
              <div key={manager.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                    manager.active ? 'bg-green-500' : 'bg-gray-400'
                  }`}>
                    <FaUsers className="text-lg" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-base sm:text-lg">{manager.name}</p>
                    <p className="text-sm sm:text-base text-gray-600">{manager.email}</p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      {manager.phone && `${manager.phone} • `}
                      {manager.active ? 'Actif' : 'Inactif'}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openModal('edit', manager)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <FaEdit className="text-sm" />
                  </button>
                  <button
                    onClick={() => resetPassword(manager)}
                    className="p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded-lg transition-colors"
                    title="Réinitialiser mot de passe"
                  >
                    <FaKey className="text-sm" />
                  </button>
                  <button
                    onClick={() => toggleManagerStatus(manager)}
                    className={`p-2 rounded-lg transition-colors ${
                      manager.active 
                        ? 'text-red-600 hover:text-red-800 hover:bg-red-100' 
                        : 'text-green-600 hover:text-green-800 hover:bg-green-100'
                    }`}
                    title={manager.active ? 'Désactiver' : 'Activer'}
                  >
                    {manager.active ? <FaUserTimes className="text-sm" /> : <FaUserCheck className="text-sm" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full h-[95vh] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-blue-50 to-green-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                      {modalType === 'create' && 'Nouveau Gérant'}
                      {modalType === 'edit' && 'Modifier le Gérant'}
                      {modalType === 'link' && 'Lier un Compte Existant'}
                    </h3>
                    <p className="text-base sm:text-lg text-gray-600 mt-1">
                      {modalType === 'create' && 'Créer un nouveau compte gérant'}
                      {modalType === 'edit' && 'Modifier les informations du gérant'}
                      {modalType === 'link' && 'Lier un compte Firebase existant'}
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>
              </div>

              {/* Contenu */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="space-y-4 sm:space-y-6">
                  {/* Nom */}
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Nom complet *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      placeholder="Nom du gérant"
                      required
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Email *</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={form.email}
                        onChange={async (e) => {
                          setForm({ ...form, email: e.target.value });
                          if (modalType === 'create') {
                            await checkEmailExists(e.target.value);
                          }
                        }}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        placeholder="email@exemple.com"
                        required
                      />
                      {checkingEmail && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <FaSync className="animate-spin text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    {emailExists && modalType === 'create' && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <FaExclamationTriangle className="text-yellow-600" />
                          <p className="text-sm text-yellow-800">
                            Cet email est déjà utilisé. Utilisez "Lier un compte existant" à la place.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Téléphone */}
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                      placeholder="+237 6XX XXX XXX"
                    />
                  </div>

                  {/* Mot de passe (seulement pour création) */}
                  {modalType === 'create' && (
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Mot de passe *</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        placeholder="Minimum 6 caractères"
                        required
                        minLength={6}
                      />
                    </div>
                  )}

                  {/* Mot de passe pour liaison */}
                  {modalType === 'link' && (
                    <div>
                      <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Mot de passe du compte existant *</label>
                      <input
                        type="password"
                        value={linkForm.password}
                        onChange={(e) => setLinkForm({ ...linkForm, password: e.target.value })}
                        className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                        placeholder="Mot de passe du compte"
                        required
                      />
                    </div>
                  )}

                  {/* Restaurant */}
                  <div>
                    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Restaurant</label>
                    <select
                      value={form.restaurantId}
                      onChange={(e) => setForm({ ...form, restaurantId: e.target.value })}
                      className="w-full border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                    >
                      <option value="">Sélectionner un restaurant...</option>
                      {restaurants.map(restaurant => (
                        <option key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Statut actif (seulement pour édition) */}
                  {modalType === 'edit' && (
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="active"
                        checked={form.active}
                        onChange={(e) => setForm({ ...form, active: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="active" className="text-sm sm:text-base font-medium text-gray-700">
                        Compte actif
                      </label>
                    </div>
                  )}

                  {/* Information pour liaison */}
                  {modalType === 'link' && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <FaInfoCircle className="text-blue-600 mt-1" />
                        <div>
                          <p className="text-sm text-blue-800 font-medium">Lier un compte existant</p>
                          <p className="text-sm text-blue-700 mt-1">
                            Cette option permet de lier un compte Firebase existant au rôle de gérant. 
                            L'utilisateur pourra se connecter avec ses identifiants actuels.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 border-t bg-white">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-3 text-gray-600 hover:text-gray-800 transition-colors text-base sm:text-lg rounded-lg border"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      if (modalType === 'create') createManager();
                      else if (modalType === 'edit') updateManager();
                      else if (modalType === 'link') linkExistingAccount();
                    }}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-base sm:text-lg"
                    disabled={checkingEmail}
                  >
                    {modalType === 'create' && 'Créer le Gérant'}
                    {modalType === 'edit' && 'Modifier'}
                    {modalType === 'link' && 'Lier le Compte'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedManagerManager;
