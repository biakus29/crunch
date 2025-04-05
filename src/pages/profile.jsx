import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import logo from '../image/logo.png';
import { useCart } from '../context/cartcontext'; // Supposons que vous avez un contexte pour le panier

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
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
  const navigate = useNavigate();
  const { cartItems } = useCart(); // Utilisation du contexte du panier

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

  // Actions Firestore pour les adresses
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
          default: addresses.length === 0, // Par défaut si première adresse
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
  };

  // Récupérer les données utilisateur et adresses
  const fetchUserData = useCallback(async (uid, currentUserEmail) => {
    try {
      setLoading(true);
      const userDocRef = doc(db, 'usersrestau', uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || currentUserEmail || '',
          phone: userData.phone || '',
        });
      }
      const loadedAddresses = await firestoreActions.loadAddresses(uid);
      setAddresses(loadedAddresses);
    } catch (err) {
      setError('Erreur lors de la récupération des données');
    } finally {
      setLoading(false);
    }
  }, []);

  // Vérifier l'état d'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchUserData(currentUser.uid, currentUser.email);
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
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

  // Déconnexion
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      setError('Erreur lors de la déconnexion');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <i className="fas fa-spinner fa-spin text-3xl text-green-600"></i>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center bg-red-100 text-red-700 rounded-lg m-4">
        {error} -{' '}
        <button onClick={() => window.location.reload()} className="underline text-red-900">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-16">
      {/* En-tête */}
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <img src={logo} alt="Logo" className="h-8" />
            <span className="font-bold text-green-600 text-lg">MANGE d'ABORD</span>
          </Link>
          <button
            onClick={() => (editMode ? setEditMode(false) : navigate(-1))}
            className="text-gray-700 hover:text-gray-900"
          >
            <i className={`fas ${editMode ? 'fa-times' : 'fa-arrow-left'} text-xl`}></i>
          </button>
        </div>
      </header>

      {/* Photo de profil et nom */}
      <div className="bg-white py-6 text-center border-b">
        <div className="relative inline-block">
          <img
            src={user?.photoURL || 'https://via.placeholder.com/100'}
            alt="Profil"
            className="w-24 h-24 rounded-full border-2 border-green-600 object-cover"
          />
          {editMode && (
            <button className="absolute bottom-0 right-0 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center">
              <i className="fas fa-camera"></i>
            </button>
          )}
        </div>
        <h5 className="mt-3 text-xl font-bold">{formData.firstName} {formData.lastName}</h5>
        <p className="text-sm text-gray-500">{formData.email}</p>
      </div>

      {/* Contenu principal */}
      <div className="container mx-auto px-4 mt-4">
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-center">
            {successMessage}
          </div>
        )}

        {!editMode ? (
          <div className="bg-white rounded-lg shadow-sm mb-4 overflow-hidden">
            <div className="p-4 border-b">
              <h6 className="font-bold text-lg">Informations personnelles</h6>
            </div>
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
            </div>

            <div className="p-4 border-t border-b flex justify-between items-center">
              <h6 className="font-bold text-lg">Adresses</h6>
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
          <div className="bg-white rounded-lg shadow-sm mb-4 overflow-hidden">
            <form>
              <div className="p-4 border-b">
                <h6 className="font-bold text-lg">Modifier le profil</h6>
              </div>
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
          </div>
        )}

        {/* Menu options */}
        <div className="bg-white rounded-lg shadow-sm mb-4 overflow-hidden">
          <Link to="/complete_order" className="flex items-center p-4 border-b hover:bg-gray-50 transition">
            <div className="bg-blue-100 p-2 rounded-lg mr-3">
              <i className="fas fa-shopping-bag text-blue-600"></i>
            </div>
            <div className="flex-1">
              <p className="font-medium">Mes commandes</p>
              <p className="text-xs text-gray-500">Historique et suivi</p>
            </div>
            <i className="fas fa-chevron-right text-gray-400"></i>
           </Link>
       {/*   <Link to="/favorites" className="flex items-center p-4 border-b hover:bg-gray-50 transition">
            <div className="bg-red-100 p-2 rounded-lg mr-3">
              <i className="fas fa-heart text-red-600"></i>
            </div>
            <div className="flex-1">
              <p className="font-medium">Favoris</p>
              <p className="text-xs text-gray-500">Mes restaurants préférés</p>
            </div>
            <i className="fas fa-chevron-right text-gray-400"></i>
          </Link>
          <Link to="/settings" className="flex items-center p-4 hover:bg-gray-50 transition">
            <div className="bg-yellow-100 p-2 rounded-lg mr-3">
              <i className="fas fa-cog text-yellow-600"></i>
            </div>
            <div className="flex-1">
              <p className="font-medium">Paramètres</p>
              <p className="text-xs text-gray-500">Préférences et confidentialité</p>
            </div>
            <i className="fas fa-chevron-right text-gray-400"></i>
          </Link> */}
        </div>

        {/* Bouton de déconnexion */}
        <button
          onClick={handleSignOut}
          className="w-full py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition"
        >
          <i className="fas fa-sign-out-alt mr-2"></i> Déconnexion
        </button>
      </div>

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
                  placeholder="Ex: 698123456"
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
      <footer className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg">
        <div className="grid grid-cols-4">
          <Link to="/" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
            <i className="fas fa-home text-lg"></i>
            <span className="block text-xs mt-1">Accueil</span>
          </Link>
          <Link to="/cart" className="relative text-gray-700 p-2 hover:text-green-600 transition-colors">
            <i className="fas fa-shopping-cart text-lg"></i>
            {cartItems.length > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-green-600 rounded-full">
                {cartItems.length}
              </span>
            )}
            <span className="block text-xs mt-1">Panier</span>
          </Link>
          <Link to="/complete_order" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
            <i className="fas fa-shopping-bag text-lg"></i>
            <span className="block text-xs mt-1">Commandes</span>
          </Link>
          <Link to="/profile" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
            <i className="fas fa-user text-lg"></i>
            <span className="block text-xs mt-1">Compte</span>
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Profile;