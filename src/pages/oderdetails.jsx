import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import debounce from "lodash/debounce";

// Constantes copiées depuis OrderStatus pour cohérence
const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  CANCELLED: "annulee",
};

// Icônes pour les types d'adresse
const addressTypeIcons = {
  Home: "fa-solid fa-house",
  Work: "fa-solid fa-briefcase",
  Other: "fa-solid fa-question",
};

// Méthodes de paiement statiques
const paymentMethods = [
  {
    id: "payemnt_mobile",
    name: "Paiement Mobile",
    icon: "fa-solid fa-mobile-screen-button",
    description: "via Orange Money ou MTN Mobile Money",
  },
  {
    id: "cash_delivery",
    name: "Cash à la Livraison",
    icon: "fa-solid fa-money-bill-wave",
    description: "Payer en espèces lors de la livraison",
  },
];

// Composant Input réutilisable
const InputField = ({ label, name, value, onChange, error, placeholder, required = false, type = "text" }) => (
  <div className="mb-3">
    <label className="block text-gray-700">
      {label} {required && "*"}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full p-2 border rounded ${error ? "border-red-500" : "border-gray-300"}`}
      placeholder={placeholder}
      required={required}
    />
    {error && <p className="text-red-500 text-sm">{error}</p>}
  </div>
);

const OrderAddress = ({ cartItems, cartTotal }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [editingAddress, setEditingAddress] = useState(null);
  const [data, setData] = useState({
    nickname: "Home",
    area: "",
    completeAddress: "",
    instructions: "",
    phone: "",
    name: "", // Pour les invités
  });
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState("");
  const [quartiersList, setQuartiersList] = useState([]);
  const [filteredQuartiers, setFilteredQuartiers] = useState([]);
  const [submitState, setSubmitState] = useState({
    googleLoading: false,
    addressSubmitLoading: false,
    continueLoading: false,
  });

  const navigate = useNavigate();

  // Validation des données
  const validateData = useCallback((fields, isConnected) => {
    const newErrors = {};
    if (!fields.area) newErrors.area = "Zone de livraison requise";
    if (!fields.completeAddress) newErrors.completeAddress = "Adresse complète requise";
    if (!fields.phone) newErrors.phone = "Téléphone requis";
    else if (!/^[0-9]{9,15}$/.test(fields.phone))
      newErrors.phone = "Numéro invalide (9-15 chiffres)";
    if (!isConnected && !fields.name) newErrors.name = "Nom requis"; // Pour les invités
    return newErrors;
  }, []);

  // Actions Firestore regroupées
  const firestoreActions = useMemo(() => ({
    saveGuestUser: async (data) => {
      const guestUsersRef = doc(db, "guestUsers", "group1");
      const docSnap = await getDoc(guestUsersRef);
      const newGuestUser = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: data.name,
        phone: data.phone,
        address: {
          nickname: data.nickname,
          area: data.area,
          completeAddress: data.completeAddress,
          instructions: data.instructions || "",
        },
        createdAt: new Date(),
      };
      if (docSnap.exists()) {
        await updateDoc(guestUsersRef, { users: arrayUnion(newGuestUser) });
      } else {
        await setDoc(guestUsersRef, { users: [newGuestUser] });
      }
    },
    loadAddresses: async (userId) => {
      const snapshot = await getDocs(collection(db, `usersrestau/${userId}/addresses`));
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
    saveAddress: async (userId, address, isEdit = false) => {
      if (isEdit) {
        await updateDoc(doc(db, `usersrestau/${userId}/addresses/${address.id}`), address);
      } else {
        await addDoc(collection(db, `usersrestau/${userId}/addresses`), {
          ...address,
          default: addresses.length === 0,
        });
      }
    },
    deleteAddress: async (userId, addressId) => {
      await deleteDoc(doc(db, `usersrestau/${userId}/addresses/${addressId}`));
    },
  }), [addresses.length]);

  // Initialisation : surveiller l'état d'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, "usersrestau", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const [firstName = "", lastName = ""] = currentUser.displayName?.split(" ") || [];
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            firstName,
            lastName,
            createdAt: new Date(),
          });
        }
        const loadedAddresses = await firestoreActions.loadAddresses(currentUser.uid);
        setAddresses(loadedAddresses);
        // Sélectionner automatiquement l'adresse par défaut si elle existe
        const defaultAddress = loadedAddresses.find((addr) => addr.default);
        if (defaultAddress) setSelectedAddress(defaultAddress.id);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [firestoreActions]);

  // Chargement des quartiers
  useEffect(() => {
    const fetchQuartiers = async () => {
      const querySnapshot = await getDocs(collection(db, "quartiers"));
      setQuartiersList(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchQuartiers();
  }, []);

  // Débouncing pour les suggestions de quartiers
  const debounceQuartierFilter = useCallback(
    debounce((value) => {
      if (value.length > 0) {
        const filtered = quartiersList.filter((q) =>
          q.name.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredQuartiers(filtered);
      } else {
        setFilteredQuartiers([]);
      }
    }, 300),
    [quartiersList] // eslint-disable-next-line react-hooks/exhaustive-deps
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => ({ ...prev, [name]: value }));
    if (name === "area") debounceQuartierFilter(value);
    setErrors((prev) => ({ ...prev, [name]: "" }));
    if (actionError) setActionError("");
  };

  const handleGoogleSignIn = async () => {
    setSubmitState((prev) => ({ ...prev, googleLoading: true }));
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      const currentUser = auth.currentUser;
      setUser(currentUser);
      setAddresses(await firestoreActions.loadAddresses(currentUser.uid));
    } catch (error) {
      setActionError("Erreur de connexion avec Google.");
    }
    setSubmitState((prev) => ({ ...prev, googleLoading: false }));
  };

  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateData(data, !!user);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSubmitState((prev) => ({ ...prev, addressSubmitLoading: true }));
    try {
      if (user) {
        await firestoreActions.saveAddress(
          user.uid,
          {
            nickname: data.nickname,
            area: data.area,
            completeAddress: data.completeAddress,
            instructions: data.instructions,
            phone: data.phone,
            ...(editingAddress ? { id: editingAddress.id } : {}),
          },
          !!editingAddress
        );
        const updatedAddresses = await firestoreActions.loadAddresses(user.uid);
        setAddresses(updatedAddresses);
        // Sélectionner automatiquement la nouvelle adresse si c'est la première
        if (!selectedAddress && updatedAddresses.length === 1) {
          setSelectedAddress(updatedAddresses[0].id);
        }
        setShowModal(false);
      }
    } catch (error) {
      setActionError("Erreur lors de l'enregistrement de l'adresse.");
    }
    setSubmitState((prev) => ({ ...prev, addressSubmitLoading: false }));
    resetForm();
  };

  const handleDeleteAddress = async (addressId) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette adresse ?")) {
      try {
        await firestoreActions.deleteAddress(user.uid, addressId);
        const updatedAddresses = addresses.filter((a) => a.id !== addressId);
        setAddresses(updatedAddresses);
        if (selectedAddress === addressId) setSelectedAddress("");
      } catch (error) {
        setActionError("Erreur lors de la suppression.");
      }
    }
  };

  const handleEditAddress = (address) => {
    setEditingAddress(address);
    setData({
      nickname: address.nickname,
      area: address.area,
      completeAddress: address.completeAddress,
      instructions: address.instructions || "",
      phone: address.phone || "",
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setData({
      nickname: "Home",
      area: "",
      completeAddress: "",
      instructions: "",
      phone: "",
      name: "",
    });
    setErrors({});
    setEditingAddress(null);
  };

  const handleContinue = async () => {
    setSubmitState((prev) => ({ ...prev, continueLoading: true }));
    
    try {
      let orderData = {};
      let navState = {};

      if (user) {
        // Pour les utilisateurs connectés
        if (!selectedAddress) {
          setActionError("Veuillez sélectionner une adresse.");
          setSubmitState((prev) => ({ ...prev, continueLoading: false }));
          return;
        }
        if (!selectedPayment) {
          setActionError("Veuillez sélectionner une méthode de paiement.");
          setSubmitState((prev) => ({ ...prev, continueLoading: false }));
          return;
        }

        const address = addresses.find((a) => a.id === selectedAddress);
        orderData = {
          userId: user.uid,
          address,
          paymentMethod: paymentMethods.find((p) => p.id === selectedPayment),
          timestamp: Timestamp.now(),
          status: ORDER_STATUS.PENDING,
          items: cartItems || [],
          total: cartTotal || 0,
        };
        navState = {
          selectedAddress: address,
          selectedPayment: orderData.paymentMethod,
          orderId: null,
        };
      } else {
        // Pour les invités
        const validationErrors = validateData(data, false);
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          setSubmitState((prev) => ({ ...prev, continueLoading: false }));
          return;
        }
        if (!selectedPayment) {
          setActionError("Veuillez sélectionner une méthode de paiement.");
          setSubmitState((prev) => ({ ...prev, continueLoading: false }));
          return;
        }

        const guestId = `guest-${data.phone}`;
        const guestRecord = {
          uid: guestId,
          email: "",
          firstName: data.name.trim(),
          phone: data.phone,
          isGuest: true,
          createdAt: new Date(),
        };
        await setDoc(doc(db, "usersrestau", guestId), guestRecord);

        await firestoreActions.saveGuestUser({
          ...data,
          guestId,
        });

        localStorage.setItem("guestUid", guestId);
        localStorage.setItem("guestPhone", data.phone);

        const contactInfo = { name: data.name, phone: data.phone };
        orderData = {
          guestId,
          contact: contactInfo,
          address: {
            nickname: data.nickname,
            area: data.area,
            completeAddress: data.completeAddress,
            instructions: data.instructions,
            phone: data.phone,
          },
          paymentMethod: paymentMethods.find((p) => p.id === selectedPayment),
          timestamp: Timestamp.now(),
          status: ORDER_STATUS.PENDING,
          items: cartItems || [],
          total: cartTotal || 0,
        };
        navState = {
          selectedAddress: orderData.address,
          selectedPayment: orderData.paymentMethod,
          contact: contactInfo,
          orderId: null,
        };
      }

      const orderRef = await addDoc(collection(db, "orders"), orderData);
      navState.orderId = orderRef.id;

      navigate("/orders", { state: navState });

    } catch (err) {
      console.error("Erreur handleContinue:", err);
      setActionError(
        err.code === "permission-denied"
          ? "Permission refusée par la base de données"
          : "Erreur lors de la création de votre compte ou commande"
      );
    } finally {
      setSubmitState((prev) => ({ ...prev, continueLoading: false }));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header user={user} onAddAddress={() => setShowModal(true)} />

      {actionError && (
        <div className="p-3">
          <div className="bg-red-100 text-red-700 p-2 rounded">{actionError}</div>
        </div>
      )}

      {!user && (
        <section className="p-3 bg-white rounded-lg shadow-sm mb-4 mt-3 mx-3">
          <h2 className="text-xl font-bold mb-3">Vos coordonnées</h2>
          <InputField
            label="Nom"
            name="name"
            value={data.name}
            onChange={handleInputChange}
            error={errors.name}
            placeholder="Votre nom"
            required
          />
          <InputField
            label="Téléphone"
            name="phone"
            value={data.phone}
            onChange={handleInputChange}
            error={errors.phone}
            placeholder="Ex: 698123456"
            required
            type="tel"
          />
        </section>
      )}

      {user && addresses.length > 0 ? (
        <AddressList
          addresses={addresses}
          selectedAddress={selectedAddress}
          onSelect={setSelectedAddress}
          onEdit={handleEditAddress}
          onDelete={handleDeleteAddress}
        />
      ) : (
        (!user || addresses.length === 0) && (
          <AddressForm
            data={data}
            onChange={handleInputChange}
            errors={errors}
            quartiers={filteredQuartiers}
            onSelectQuartier={(name) => {
              setData((prev) => ({ ...prev, area: name }));
              setFilteredQuartiers([]);
            }}
            showPhone={false}
          />
        )
      )}

      <PaymentMethods
        methods={paymentMethods}
        selected={selectedPayment}
        onSelect={setSelectedPayment}
      />

      <div className="p-3 space-y-2">
        {!user && (
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center py-3 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            disabled={submitState.googleLoading}
          >
            {submitState.googleLoading ? <Spinner /> : <i className="fa-brands fa-google mr-2"></i>}
            Continuer avec Google
          </button>
        )}
        <button
          onClick={handleContinue}
          disabled={
            submitState.continueLoading ||
            !selectedPayment ||
            (user && addresses.length > 0 && !selectedAddress) ||
            (!user && (!data.name || !data.phone || !data.area || !data.completeAddress))
          }
          className={`w-full py-3 rounded-lg transition-colors flex items-center justify-center ${
            (user && selectedAddress && selectedPayment) ||
            (!user && data.name && data.phone && data.area && data.completeAddress && selectedPayment)
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {submitState.continueLoading ? <Spinner /> : "Continuer"}
        </button>
      </div>

      {user && showModal && (
        <AddressModal
          data={data}
          onChange={handleInputChange}
          errors={errors}
          onSubmit={handleAddressSubmit}
          onClose={() => {
            setShowModal(false);
            resetForm();
          }}
          loading={submitState.addressSubmitLoading}
          editing={!!editingAddress}
          quartiers={filteredQuartiers}
          onSelectQuartier={(name) => {
            setData((prev) => ({ ...prev, area: name }));
            setFilteredQuartiers([]);
          }}
        />
      )}
    </div>
  );
};

// Composants séparés

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
  </div>
);

const Spinner = () => <i className="fa-solid fa-spinner animate-spin mr-2"></i>;

const Header = ({ user, onAddAddress }) => (
  <div className="bg-white p-3 border-b flex items-center">
    <Link to="/cart" className="text-green-600 font-bold">
      <i className="fa-solid fa-arrow-left"></i>
    </Link>
    <h5 className="font-bold mx-3">{user ? "Sélectionnez une adresse" : "Vos coordonnées et adresse"}</h5>
    {user && (
      <button onClick={onAddAddress} className="ml-auto bg-green-600 text-white px-3 py-1 rounded text-sm">
        Nouvelle adresse
      </button>
    )}
  </div>
);

const AddressList = ({ addresses, selectedAddress, onSelect, onEdit, onDelete }) => (
  <div className="p-3">
    {addresses.length > 0 ? (
      addresses.map((address) => (
        <div key={address.id} className="bg-white rounded-lg shadow-sm p-3 mb-3 flex items-start">
          <input
            type="radio"
            checked={selectedAddress === address.id}
            onChange={() => onSelect(address.id)}
            className="mt-1 h-5 w-5 text-green-600"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center">
              <h6 className="font-semibold">{address.nickname}</h6>
              <button onClick={() => onEdit(address)} className="ml-2 text-green-600 hover:text-green-800">
                <i className="fa-solid fa-pen-to-square"></i>
              </button>
              <button onClick={() => onDelete(address.id)} className="ml-2 text-red-600 hover:text-red-800">
                <i className="fa-solid fa-trash"></i>
              </button>
              {address.default && (
                <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Par défaut</span>
              )}
            </div>
            <p className="text-gray-600">{address.area}</p>
            <p className="text-gray-600">{address.completeAddress}</p>
            <p className="text-gray-600">Téléphone: {address.phone}</p>
          </div>
        </div>
      ))
    ) : (
      <p className="text-gray-600">Aucune adresse enregistrée</p>
    )}
  </div>
);

const AddressForm = ({ data, onChange, errors, quartiers, onSelectQuartier, showPhone }) => (
  <section className="p-3 bg-white rounded-lg shadow-sm mb-4 mx-3">
    <h2 className="text-xl font-bold mb-3">Lieu de livraison</h2>
    <div className="mb-3">
      <label className="block">Type d'adresse</label>
      <div className="grid grid-cols-3 gap-2 mt-1">
        {["Home", "Work", "Other"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange({ target: { name: "nickname", value: type } })}
            className={`p-2 rounded flex items-center justify-center gap-2 ${
              data.nickname === type ? "bg-green-100 border-green-600 text-green-600" : "border border-gray-200 hover:border-gray-300"
            }`}
          >
            <i className={addressTypeIcons[type]}></i>
            {type}
          </button>
        ))}
      </div>
    </div>
    <div className="mb-3">
      <label className="block">Ville</label>
      <span>YAOUNDE</span>
    </div>
    <InputField
      label="Quartier"
      name="area"
      value={data.area}
      onChange={onChange}
      error={errors.area}
      placeholder="Votre zone de livraison"
      required
    />
    {quartiers.length > 0 && (
      <div className="absolute z-10 bg-white w-full border border-gray-300 rounded mt-1 max-h-48 overflow-y-auto">
        {quartiers.map((q) => (
          <div key={q.id} onClick={() => onSelectQuartier(q.name)} className="p-2 hover:bg-gray-100 cursor-pointer">
            {q.name}
          </div>
        ))}
      </div>
    )}
    <InputField
      label="Description"
      name="completeAddress"
      value={data.completeAddress}
      onChange={onChange}
      error={errors.completeAddress}
      placeholder="Votre adresse complète"
      required
    />
    {showPhone && (
      <InputField
        label="Téléphone"
        name="phone"
        value={data.phone}
        onChange={onChange}
        error={errors.phone}
        placeholder="Ex: 698123456"
        required
        type="tel"
      />
    )}
  </section>
);

const PaymentMethods = ({ methods, selected, onSelect }) => (
  <section className="p-3 bg-white rounded-lg shadow-sm mb-4 mx-3">
    <h6 className="font-bold mb-3 text-lg">Méthode de paiement *</h6>
    <div className="space-y-3">
      {methods.map((method) => (
        <label key={method.id} className="flex items-center bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="payment-method"
            value={method.id}
            checked={selected === method.id}
            onChange={(e) => onSelect(e.target.value)}
            className="h-5 w-5 text-green-600"
          />
          <div className="ml-3 flex-1 flex items-center">
            <i className={`${method.icon} text-green-600 text-xl mr-3`}></i>
            <div>
              <p className="font-semibold">{method.name}</p>
              <p className="text-sm text-gray-500">{method.description}</p>
            </div>
          </div>
        </label>
      ))}
    </div>
  </section>
);

const AddressModal = ({ data, onChange, errors, onSubmit, onClose, loading, editing, quartiers, onSelectQuartier }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg w-full max-w-md">
      <div className="p-4 border-b flex justify-between items-center">
        <h5 className="font-semibold">{editing ? "Modifier l'adresse" : "Nouveau Lieu"}</h5>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
      </div>
      <form onSubmit={onSubmit} className="p-4 space-y-4">
        <div>
          <label className="block">Type d'adresse</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {["Home", "Work", "Other"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange({ target: { name: "nickname", value: type } })}
                className={`p-2 rounded flex items-center justify-center gap-2 ${
                  data.nickname === type ? "bg-green-100 border-green-600 text-green-600" : "border border-gray-200 hover:border-gray-300"
                }`}
              >
                <i className={addressTypeIcons[type]}></i>
                {type}
              </button>
            ))}
          </div>
        </div>
        <InputField
          label="Lieu de livraison"
          name="area"
          value={data.area}
          onChange={onChange}
          error={errors.area}
          placeholder="Votre zone de livraison"
          required
        />
        {quartiers.length > 0 && (
          <div className="absolute z-10 bg-white w-full border border-gray-300 rounded mt-1 max-h-48 overflow-y-auto">
            {quartiers.map((q) => (
              <div key={q.id} onClick={() => onSelectQuartier(q.name)} className="p-2 hover:bg-gray-100 cursor-pointer">
                {q.name}
              </div>
            ))}
          </div>
        )}
        <InputField
          label="Description"
          name="completeAddress"
          value={data.completeAddress}
          onChange={onChange}
          error={errors.completeAddress}
          placeholder="Votre adresse complète"
          required
        />
        <InputField
          label="Téléphone"
          name="phone"
          value={data.phone}
          onChange={onChange}
          error={errors.phone}
          placeholder="Ex: 698123456"
          required
          type="tel"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 p-2 bg-gray-100 rounded">
            Annuler
          </button>
          <button type="submit" className="flex-1 p-2 bg-green-600 text-white rounded flex items-center justify-center">
            {loading ? <Spinner /> : editing ? "Mettre à jour" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default OrderAddress;