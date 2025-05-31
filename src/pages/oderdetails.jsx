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

// Constantes
const ORDER_STATUS = {
  PENDING: "en_attente",
  PREPARING: "en_preparation",
  DELIVERING: "en_livraison",
  DELIVERED: "livree",
  CANCELLED: "annulee",
};

const addressTypeIcons = {
  Home: "fa-solid fa-house",
  Work: "fa-solid fa-briefcase",
  Other: "fa-solid fa-question",
};

const paymentMethods = [
  {
    id: "payment_mobile",
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

// Composants réutilisables
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

// Composant principal
const OrderAddress = ({ cartItems, cartTotal }) => {
  const [user, setUser] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [mobilePaymentPhone, setMobilePaymentPhone] = useState("");
  const [editingAddress, setEditingAddress] = useState(null);
  const [data, setData] = useState({
    nickname: "Home",
    city: "Yaoundé",
    area: "",
    completeAddress: "",
    instructions: "",
    phone: "",
    name: "",
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
  const [deliveryFee, setDeliveryFee] = useState(0);

  const navigate = useNavigate();

  // Validation des données
  const validateData = useCallback((fields, isConnected) => {
    const newErrors = {};
    if (!fields.city) newErrors.city = "Ville requise";
    if (!fields.area) newErrors.area = "Quartier requis";
    if (!fields.completeAddress) newErrors.completeAddress = "Adresse complète requise";
    if (!fields.phone) newErrors.phone = "Téléphone requis";
    else if (!/^\+?[0-9]{9,15}$/.test(fields.phone))
      newErrors.phone = "Numéro invalide (9-15 chiffres, indicatif + optionnel)";
    if (!isConnected && !fields.name) newErrors.name = "Nom requis";
    return newErrors;
  }, []);

  // Actions Firestore
  const firestoreActions = useMemo(() => ({
    saveGuestUser: async (data) => {
      const guestId = `guest-${data.phone}`;
      const guestUsersRef = doc(db, "guestUsers", "group1");
      const docSnap = await getDoc(guestUsersRef);
      const newGuestUser = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: data.name,
        phone: data.phone,
        address: {
          nickname: data.nickname,
          city: data.city,
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

      const userRef = doc(db, "usersrestau", guestId);
      await setDoc(userRef, {
        createdAt: new Date(),
        email: "",
        firstName: data.name,
        isGuest: true,
        phone: data.phone,
        uid: guestId,
      }, { merge: true });

      await addDoc(collection(db, `usersrestau/${guestId}/addresses`), {
        area: data.area,
        city: data.city,
        completeAddress: data.completeAddress,
        default: true,
        instructions: data.instructions || "",
        nickname: data.nickname,
        phone: `237${data.phone}`,
      });

      await addDoc(collection(db, `usersRestau/${guestId}/addresses`), {
        area: data.area,
        city: data.city,
        completeAddress: data.completeAddress,
        default: true,
        instructions: data.instructions || "",
        nickname: data.nickname,
        phone: `237${data.phone}`,
      });

      localStorage.setItem("guestUid", guestId);
    },
    loadAddresses: async (userId) => {
      try {
        const usersrestauSnapshot = await getDocs(collection(db, `usersrestau/${userId}/addresses`));
        const usersrestauAddresses = usersrestauSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          source: "usersrestau",
        }));

        const usersRestauSnapshot = await getDocs(collection(db, `usersRestau/${userId}/addresses`));
        const usersRestauAddresses = usersRestauSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          source: "usersRestau",
        }));

        const combinedAddresses = [];
        const addressIds = new Set();

        usersrestauAddresses.forEach((addr) => {
          combinedAddresses.push(addr);
          addressIds.add(addr.id);
        });

        usersRestauAddresses.forEach((addr) => {
          if (!addressIds.has(addr.id)) {
            combinedAddresses.push(addr);
            addressIds.add(addr.id);
          }
        });

        return combinedAddresses;
      } catch (error) {
        console.error("Erreur lors de la récupération des adresses :", error);
        return [];
      }
    },
    saveAddress: async (userId, address, isEdit = false) => {
      try {
        if (isEdit) {
          await updateDoc(doc(db, `usersrestau/${userId}/addresses/${address.id}`), {
            area: address.area,
            city: address.city,
            completeAddress: address.completeAddress,
            default: address.default || false,
            instructions: address.instructions || "",
            nickname: address.nickname,
            phone: address.phone,
          });
          await updateDoc(doc(db, `usersRestau/${userId}/addresses/${address.id}`), {
            area: address.area,
            city: address.city,
            completeAddress: address.completeAddress,
            default: address.default || false,
            instructions: address.instructions || "",
            nickname: address.nickname,
            phone: address.phone,
          });
        } else {
          const docRef = await addDoc(collection(db, `usersrestau/${userId}/addresses`), {
            area: address.area,
            city: address.city,
            completeAddress: address.completeAddress,
            default: true,
            instructions: address.instructions || "",
            nickname: address.nickname,
            phone: address.phone,
          });
          await addDoc(collection(db, `usersRestau/${userId}/addresses`), {
            area: address.area,
            city: address.city,
            completeAddress: address.completeAddress,
            default: true,
            instructions: address.instructions || "",
            nickname: address.nickname,
            phone: address.phone,
          });
          return docRef.id;
        }
      } catch (error) {
        console.error("Erreur lors de l'enregistrement de l'adresse :", error);
        throw error;
      }
    },
    deleteAddress: async (userId, addressId) => {
      try {
        await deleteDoc(doc(db, `usersrestau/${userId}/addresses/${addressId}`));
        await deleteDoc(doc(db, `usersRestau/${userId}/addresses/${addressId}`));
      } catch (error) {
        console.error("Erreur lors de la suppression de l'adresse :", error);
        throw error;
      }
    },
    setDefaultAddress: async (userId, addressId) => {
      try {
        const usersrestauAddressesRef = collection(db, `usersrestau/${userId}/addresses`);
        const usersrestauSnapshot = await getDocs(usersrestauAddressesRef);
        usersrestauSnapshot.forEach(async (doc) => {
          await updateDoc(doc.ref, { default: doc.id === addressId });
        });

        const usersRestauAddressesRef = collection(db, `usersRestau/${userId}/addresses`);
        const usersRestauSnapshot = await getDocs(usersRestauAddressesRef);
        usersRestauSnapshot.forEach(async (doc) => {
          await updateDoc(doc.ref, { default: doc.id === addressId });
        });
      } catch (error) {
        console.error("Erreur lors de la définition de l'adresse par défaut :", error);
        throw error;
      }
    },
  }), []);

  // Initialisation de l'état d'authentification
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
        setAddresses(loadedAddresses || []);
        const defaultAddress = loadedAddresses.find((addr) => addr.default);
        if (defaultAddress) setSelectedAddress(defaultAddress.id);
      } else {
        const storedGuestId = localStorage.getItem("guestUid");
        const storedGuestPhone = localStorage.getItem("guestPhone");
        if (storedGuestId || storedGuestPhone) {
          const guestId = storedGuestId || `guest-${storedGuestPhone}`;
          setGuestId(guestId);
          const loadedAddresses = await firestoreActions.loadAddresses(guestId);
          setAddresses(loadedAddresses || []);
          const defaultAddress = loadedAddresses.find((addr) => addr.default);
          if (defaultAddress) setSelectedAddress(defaultAddress.id);
          if (storedGuestPhone) {
            setData((prev) => ({
              ...prev,
              phone: storedGuestPhone,
              name: prev.name || "",
            }));
          }
        }
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

  // Filtrage des quartiers
  useEffect(() => {
    if (data.area.length > 0) {
      const filtered = quartiersList.filter((q) =>
        q.name.toLowerCase().includes(data.area.toLowerCase())
      );
      setFilteredQuartiers(filtered);
    } else {
      setFilteredQuartiers([]);
    }
  }, [data.area, quartiersList]);

  // Calcul des frais de livraison
  useEffect(() => {
    if (data.area && quartiersList.length > 0) {
      const selectedQuartier = quartiersList.find(
        (q) => q.name.toLowerCase() === data.area.toLowerCase()
      );
      const fee = selectedQuartier ? selectedQuartier.fee : 0;
      setDeliveryFee(fee);
    } else {
      setDeliveryFee(0);
    }
  }, [data.area, quartiersList]);

  // Gestion des changements d'entrée
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    if (actionError) setActionError("");
  };

  // Gestion du numéro de paiement mobile
  const handleMobilePaymentPhoneChange = (e) => {
    setMobilePaymentPhone(e.target.value);
    setErrors((prev) => ({ ...prev, mobilePaymentPhone: "" }));
  };

  // Sélection d'un quartier
  const handleQuartierSelect = (name) => {
    setData((prev) => ({ ...prev, area: name }));
    setFilteredQuartiers([]);
  };

  // Connexion avec Google et enregistrement automatique
  const handleGoogleSignIn = async () => {
    setSubmitState((prev) => ({ ...prev, googleLoading: true }));
    try {
      const validationErrors = validateData(data, false);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        setSubmitState((prev) => ({ ...prev, googleLoading: false }));
        return;
      }

      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      const currentUser = auth.currentUser;
      setUser(currentUser);

      let loadedAddresses = await firestoreActions.loadAddresses(currentUser.uid);
      setAddresses(loadedAddresses || []);

      if (loadedAddresses.length === 0) {
        const newAddressId = await firestoreActions.saveAddress(currentUser.uid, {
          nickname: data.nickname,
          city: data.city,
          area: data.area,
          completeAddress: data.completeAddress,
          instructions: data.instructions,
          phone: data.phone,
        });
        loadedAddresses = await firestoreActions.loadAddresses(currentUser.uid);
        setAddresses(loadedAddresses || []);
        setSelectedAddress(newAddressId);
      } else {
        const defaultAddress = loadedAddresses.find((addr) => addr.default);
        setSelectedAddress(defaultAddress ? defaultAddress.id : loadedAddresses[0].id);
      }

      if (selectedPayment) {
        await handleContinue();
      }
    } catch (error) {
      setActionError("Erreur de connexion avec Google.");
    }
    setSubmitState((prev) => ({ ...prev, googleLoading: false }));
  };

  // Soumission d'une adresse (pour la modale)
  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateData(data, !!user);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSubmitState((prev) => ({ ...prev, addressSubmitLoading: true }));
    try {
      const userId = user ? user.uid : guestId;
      if (userId) {
        await firestoreActions.saveAddress(
          userId,
          {
            nickname: data.nickname,
            city: data.city,
            area: data.area,
            completeAddress: data.completeAddress,
            instructions: data.instructions,
            phone: `237${data.phone}`,
            ...(editingAddress ? { id: editingAddress.id } : {}),
          },
          !!editingAddress
        );
        const updatedAddresses = await firestoreActions.loadAddresses(userId);
        setAddresses(updatedAddresses || []);
        if (!selectedAddress && updatedAddresses.length === 1) {
          setSelectedAddress(updatedAddresses[0].id);
        }
        setShowModal(false);
      } else {
        setActionError("Aucun utilisateur ou invité détecté. Veuillez réessayer.");
      }
    } catch (error) {
      setActionError("Erreur lors de l'enregistrement de l'adresse.");
    }
    setSubmitState((prev) => ({ ...prev, addressSubmitLoading: false }));
    resetForm();
  };

  // Suppression d'une adresse
  const handleDeleteAddress = async (addressId) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette adresse ?")) {
      try {
        const userId = user ? user.uid : guestId;
        if (userId) {
          await firestoreActions.deleteAddress(userId, addressId);
          const updatedAddresses = addresses.filter((a) => a.id !== addressId);
          setAddresses(updatedAddresses || []);
          if (selectedAddress === addressId) setSelectedAddress("");
        } else {
          setActionError("Aucun utilisateur ou invité détecté.");
        }
      } catch (error) {
        setActionError("Erreur lors de la suppression.");
      }
    }
  };

  // Modification d'une adresse
  const handleEditAddress = (address) => {
    setEditingAddress(address);
    setData({
      nickname: address.nickname,
      city: address.city,
      area: address.area,
      completeAddress: address.completeAddress,
      instructions: address.instructions || "",
      phone: address.phone.replace(/^237/, ""),
      name: data.name,
    });
    setShowModal(true);
  };

  // Réinitialisation du formulaire
  const resetForm = () => {
    setData({
      nickname: "Home",
      city: "Yaoundé",
      area: "",
      completeAddress: "",
      instructions: "",
      phone: user ? "" : data.phone,
      name: user ? "" : data.name,
    });
    setErrors({});
    setEditingAddress(null);
  };

  // Gestion de la continuation
  const handleContinue = async () => {
    setSubmitState((prev) => ({ ...prev, continueLoading: true }));
    try {
      if (selectedPayment === "payment_mobile" && !/^\+?[0-9]{9,15}$/.test(mobilePaymentPhone)) {
        setErrors((prev) => ({
          ...prev,
          mobilePaymentPhone: "Numéro de téléphone invalide pour le paiement mobile",
        }));
        setSubmitState((prev) => ({ ...prev, continueLoading: false }));
        return;
      }

      let orderData = {};
      let navState = {};

      if (user) {
        let addressToUse;
        if (addresses.length === 0) {
          const validationErrors = validateData(data, true);
          if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            setSubmitState((prev) => ({ ...prev, continueLoading: false }));
            return;
          }
          const newAddressId = await firestoreActions.saveAddress(user.uid, {
            nickname: data.nickname,
            city: data.city,
            area: data.area,
            completeAddress: data.completeAddress,
            instructions: data.instructions,
            phone: `237${data.phone}`,
          });
          const updatedAddresses = await firestoreActions.loadAddresses(user.uid);
          setAddresses(updatedAddresses || []);
          setSelectedAddress(newAddressId);
          addressToUse = updatedAddresses.find((addr) => addr.id === newAddressId);
        } else if (!selectedAddress) {
          setActionError("Veuillez sélectionner une adresse.");
          setSubmitState((prev) => ({ ...prev, continueLoading: false }));
          return;
        } else {
          addressToUse = addresses.find((a) => a.id === selectedAddress);
        }

        if (!selectedPayment) {
          setActionError("Veuillez sélectionner une méthode de paiement.");
          setSubmitState((prev) => ({ ...prev, continueLoading: false }));
          return;
        }

        orderData = {
          userId: user.uid,
          address: addressToUse,
          paymentMethod: {
            ...paymentMethods.find((p) => p.id === selectedPayment),
            phone: selectedPayment === "payment_mobile" ? mobilePaymentPhone : null,
          },
          timestamp: Timestamp.now(),
          status: ORDER_STATUS.PENDING,
          items: cartItems || [],
          subtotal: cartTotal || 0,
          deliveryFee,
          total: cartTotal + deliveryFee,
        };
        navState = {
          selectedAddress: addressToUse,
          selectedPayment: orderData.paymentMethod,
          orderId: null,
          deliveryFee,
        };
        await firestoreActions.setDefaultAddress(user.uid, addressToUse.id);
      } else {
        let addressToUse;
        if (addresses.length === 0) {
          const validationErrors = validateData(data, false);
          if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            setSubmitState((prev) => ({ ...prev, continueLoading: false }));
            return;
          }
          await firestoreActions.saveGuestUser({
            ...data,
            phone: data.phone,
          });
          const updatedAddresses = await firestoreActions.loadAddresses(`guest-${data.phone}`);
          setAddresses(updatedAddresses || []);
          setGuestId(`guest-${data.phone}`);
          addressToUse = updatedAddresses.find((addr) => addr.default);
          setSelectedAddress(addressToUse?.id);
        } else if (!selectedAddress) {
          setActionError("Veuillez sélectionner une adresse.");
          setSubmitState((prev) => ({ ...prev, continueLoading: false }));
          return;
        } else {
          addressToUse = addresses.find((a) => a.id === selectedAddress);
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

        localStorage.setItem("guestUid", guestId);
        localStorage.setItem("guestPhone", data.phone);

        const contactInfo = { name: data.name, phone: data.phone };
        orderData = {
          guestId,
          contact: contactInfo,
          address: addressToUse,
          paymentMethod: {
            ...paymentMethods.find((p) => p.id === selectedPayment),
            phone: selectedPayment === "payment_mobile" ? mobilePaymentPhone : null,
          },
          timestamp: Timestamp.now(),
          status: ORDER_STATUS.PENDING,
          items: cartItems || [],
          subtotal: cartTotal || 0,
          deliveryFee,
          total: cartTotal + deliveryFee,
        };
        navState = {
          selectedAddress: addressToUse,
          selectedPayment: orderData.paymentMethod,
          contact: contactInfo,
          orderId: null,
          deliveryFee,
        };
        if (addressToUse.id) {
          await firestoreActions.setDefaultAddress(guestId, addressToUse.id);
        }
      }

      const orderRef = await addDoc(collection(db, "orders"), orderData);
      navState.orderId = orderRef.id;
      navigate("/orders", { state: navState });
    } catch (err) {
      setActionError("Erreur lors de la création de la commande.");
    } finally {
      setSubmitState((prev) => ({ ...prev, continueLoading: false }));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header user={user} onAddAddress={() => setShowModal(true)} addresses={addresses} />
      {actionError && (
        <div className="p-3">
          <div className="bg-red-100 text-red-700 p-2 rounded">{actionError}</div>
        </div>
      )}

      {addresses.length > 0 ? (
        <AddressList
          addresses={addresses}
          selectedAddress={selectedAddress}
          onSelect={(addressId) => {
            setSelectedAddress(addressId);
            const userId = user ? user.uid : guestId;
            if (userId) {
              firestoreActions.setDefaultAddress(userId, addressId);
            }
          }}
          onEdit={handleEditAddress}
          onDelete={handleDeleteAddress}
        />
      ) : (
        <section className="p-3 bg-white rounded-lg shadow-sm mb-4 mt-3 mx-3">
          <h2 className="text-xl font-bold mb-3">{user ? "Nouvelle adresse" : "Vos coordonnées"}</h2>
          {!user && (
            <InputField
              label="Nom"
              name="name"
              value={data.name}
              onChange={handleInputChange}
              error={errors.name}
              placeholder="Votre nom"
              required
            />
          )}
          <AddressForm
            data={data}
            onChange={handleInputChange}
            errors={errors}
            quartiers={quartiersList}
            filteredQuartiers={filteredQuartiers}
            onQuartierSelect={handleQuartierSelect}
            showPhone={true}
          />
          {deliveryFee > 0 && (
            <div className="mt-3 text-gray-700">
              Frais de livraison : {deliveryFee} FCFA
            </div>
          )}
        </section>
      )}

      <PaymentMethods
        methods={paymentMethods}
        selected={selectedPayment}
        onSelect={setSelectedPayment}
        mobilePaymentPhone={mobilePaymentPhone}
        handleMobilePaymentPhoneChange={handleMobilePaymentPhoneChange}
        errors={errors}
      />

      <div className="p-3 space-y-2">
        {!user && (
          <>
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex flex-col items-center justify-center py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400"
              disabled={submitState.googleLoading}
            >
              <div className="flex items-center">
                {submitState.googleLoading ? (
                  <Spinner />
                ) : (
                  <i className="fa-brands fa-google mr-1 text-base" />
                )}
                <span className="font-semibold text-sm">Continuer avec Google</span>
              </div>
              {!submitState.googleLoading && (
                <span className="text-[10px] text-green-100 mt-0.5">
                  (Plus besoin de répéter le processus)
                </span>
              )}
            </button>
            <button
              onClick={handleContinue}
              className="w-full py-3 rounded-lg bg-white text-green-600 border border-green-600 hover:bg-gray-100"
              disabled={submitState.continueLoading}
            >
              {submitState.continueLoading ? <Spinner /> : "Continuer "}
            </button>
          </>
        )}
        {user && (
          <button
            onClick={handleContinue}
            disabled={
              (addresses.length > 0 && !selectedAddress) || !selectedPayment || submitState.continueLoading
            }
            className={`w-full py-3 rounded-lg transition-colors flex items-center justify-center ${
              (addresses.length === 0 || selectedAddress) && selectedPayment
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {submitState.continueLoading ? <Spinner /> : "Continuer"}
          </button>
        )}
      </div>

      {showModal && (
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
          quartiers={quartiersList}
          filteredQuartiers={filteredQuartiers}
          onQuartierSelect={handleQuartierSelect}
          deliveryFee={deliveryFee}
        />
      )}
    </div>
  );
};

// Composants auxiliaires
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
  </div>
);

const Spinner = () => <i className="fa-solid fa-spinner animate-spin mr-2"></i>;

const Header = ({ user, onAddAddress, addresses = [] }) => (
  <div className="bg-white p-3 border-b flex items-center">
    <Link to="/cart" className="text-green-600 font-bold">
      <i className="fa-solid fa-arrow-left"></i>
    </Link>
    <h5 className="font-bold mx-3">{user || addresses.length > 0 ? "Sélectionnez une adresse" : "Vos coordonnées et adresse"}</h5>
    {(user || addresses.length > 0) && (
      <button onClick={onAddAddress} className="ml-auto bg-green-600 text-white px-3 py-1 rounded text-sm">
        Nouvelle adresse
      </button>
    )}
  </div>
);

const AddressList = ({ addresses, selectedAddress, onSelect, onEdit, onDelete }) => (
  <div className="p-3">
    {addresses.map((address) => (
      <div key={`${address.source}-${address.id}`} className="bg-white rounded-lg shadow-sm p-3 mb-3 flex items-start">
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
          <p className="text-gray-600">{address.city} - {address.area}</p>
          <p className="text-gray-600">{address.completeAddress}</p>
          <p className="text-gray-600">Téléphone: {address.phone}</p>
        </div>
      </div>
    ))}
  </div>
);

const AddressForm = ({ data, onChange, errors, filteredQuartiers, onQuartierSelect, showPhone }) => (
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
      <select
        name="city"
        value={data.city}
        onChange={onChange}
        className="w-full p-2 border rounded"
      >
        <option value="Yaoundé">Yaoundé</option>
        <option value="Douala" disabled>Douala (Indisponible pour le moment)</option>
      </select>
    </div>
    <div className="mb-3 relative">
      <label className="block">Quartier</label>
      <input
        type="text"
        name="area"
        value={data.area}
        onChange={onChange}
        className={`w-full p-2 border rounded ${errors.area ? "border-red-500" : "border-gray-300"}`}
        placeholder="Votre zone de livraison"
        required
      />
      {filteredQuartiers.length > 0 && (
        <div className="absolute z-10 bg-white w-full border border-gray-300 rounded mt-1 max-h-48 overflow-y-auto">
          {filteredQuartiers.map((q) => (
            <div
              key={q.id}
              onClick={() => onQuartierSelect(q.name)}
              className="p-2 hover:bg-gray-100 cursor-pointer"
            >
              {q.name}
            </div>
          ))}
        </div>
      )}
    </div>
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

const PaymentMethods = ({ methods, selected, onSelect, mobilePaymentPhone, handleMobilePaymentPhoneChange, errors }) => (
  <section className="p-3 bg-white rounded-lg shadow-sm mb-4 mx-3">
    <h6 className="font-bold mb-3 text-lg">Méthode de paiement *</h6>
    <div className="space-y-3">
      {methods.map((method) => (
        <div key={method.id}>
          <label className="flex items-center bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50">
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
          {method.id === "payment_mobile" && selected === "payment_mobile" && (
            <InputField
              label="Numéro pour paiement mobile"
              name="mobilePaymentPhone"
              value={mobilePaymentPhone}
              onChange={handleMobilePaymentPhoneChange}
              error={errors.mobilePaymentPhone}
              placeholder="Ex: +237698123456"
              required
              type="tel"
            />
          )}
        </div>
      ))}
    </div>
  </section>
);

const AddressModal = ({ data, onChange, errors, onSubmit, onClose, loading, editing, filteredQuartiers, onQuartierSelect, deliveryFee }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg w-full max-w-md">
      <div className="p-4 border-b flex justify-between items-center">
        <h5 className="font-semibold">{editing ? "Modifier l'adresse" : "Nouvelle adresse"}</h5>
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
        <div className="mb-3">
          <label className="block">Ville</label>
          <select
            name="city"
            value={data.city}
            onChange={onChange}
            className="w-full p-2 border rounded"
          >
            <option value="Yaoundé">Yaoundé</option>
            <option value="Douala" disabled>Douala (Indisponible pour le moment)</option>
          </select>
        </div>
        <div className="mb-3 relative">
          <label className="block">Quartier</label>
          <input
            type="text"
            name="area"
            value={data.area}
            onChange={onChange}
            className={`w-full p-2 border rounded ${errors.area ? "border-red-500" : "border-gray-300"}`}
            placeholder="Votre zone de livraison"
            required
          />
          {filteredQuartiers.length > 0 && (
            <div className="absolute z-10 bg-white w-full border border-gray-300 rounded mt-1 max-h-48 overflow-y-auto">
              {filteredQuartiers.map((q) => (
                <div
                  key={q.id}
                  onClick={() => onQuartierSelect(q.name)}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                >
                  {q.name}
                </div>
              ))}
            </div>
          )}
        </div>
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
        {deliveryFee > 0 && (
          <div className="text-gray-700">
            Frais de livraison : {deliveryFee} FCFA
          </div>
        )}
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