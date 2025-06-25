import { useState, useEffect, useCallback, memo } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  Timestamp,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { formatPrice } from "./restaurantadmin";

const DEFAULT_DELIVERY_FEE = 1000;

// Fonction pour normaliser les prix
const convertPrice = (price) => {
  if (!price || price === undefined || price === null) return 0;
  try {
    if (typeof price === 'string') {
      return parseFloat(price.replace(/\./g, '')) || 0;
    }
    return Number(price) || 0;
  } catch (err) {
    console.warn('Erreur dans convertPrice:', price, err);
    return 0;
  }
};

// Fonction de normalisation des numéros de téléphone
const normalizePhone = (input) => {
  const cleaned = input.replace(/[\D\s]/g, "");
  const variations = [
    `+237${cleaned.replace(/^237/, "")}`,
    cleaned,
    `+${cleaned}`,
    cleaned.replace(/^237/, ""),
    input,
  ].filter((v, i, arr) => v && arr.indexOf(v) === i && v.length >= 9);
  return variations;
};

// Fonction pour générer le message WhatsApp
const generateWhatsAppMessage = (formData, confirmedItems, items, extraLists, total, orderId) => {
  const customerName = formData.name || "Client";
  const deliveryDate = new Date().toLocaleDateString("fr-FR");
  const deliveryTime = "Le plus tôt possible";
  const deliveryLocation = `${formData.address.area} | ${formatPrice(formData.deliveryFee)} FCFA`;
  const formattedPhone = normalizePhone(formData.phone).find((v) => v.startsWith("+")) || `+${formData.phone}`;

  // Formatage des articles
  const itemLines = [...formData.items, ...confirmedItems].map((item) => {
    const currentItem = items.find((it) => it.id === item.dishId);
    const itemName = currentItem?.name || "Plat inconnu";
    const size = item.size || null;
    const isSizeBased = currentItem?.priceType === "sizes" && currentItem?.sizes && size;
    const itemPrice = isSizeBased
      ? convertPrice(currentItem.sizes[size])
      : convertPrice(currentItem?.price || 0);
    const extrasDetails = Object.entries(item.extras || {})
      .map(([extraListId, indexes]) => {
        const extraList = extraLists.find((el) => el.id === extraListId);
        return indexes.map((idx) => {
          const extra = extraList?.extraListElements[idx];
          return extra?.name || "";
        }).join(", ");
      })
      .filter(Boolean)
      .join("; ");
    const extrasPrice = Object.entries(item.extras || {}).reduce(
      (sum, [extraListId, indexes]) => {
        const extraList = extraLists.find((el) => el.id === extraListId);
        return sum + indexes.reduce((acc, idx) => {
          const extra = extraList?.extraListElements[idx];
          return acc + (extra?.price ? convertPrice(extra.price) : 0);
        }, 0);
      },
      0
    );
    const itemTotal = (itemPrice + extrasPrice) * item.quantity;
    return `*${itemName}${isSizeBased ? ` (${size})` : ""}* : ${formatPrice(itemTotal)} FCFA = ${item.quantity} x ${currentItem?.description || ""}${extrasDetails ? ` + ${extrasDetails}` : ""}`;
  }).join("\n");

  // Formatage des assortiments (extras, boisson)
  const extrasSummary = [...formData.items, ...confirmedItems]
    .flatMap((item) => Object.entries(item.extras || {})
      .map(([extraListId, indexes]) => {
        const extraList = extraLists.find((el) => el.id === extraListId);
        return indexes.map((idx) => {
          const extra = extraList?.extraListElements[idx];
          return extra?.name || "";
        });
      })
      .filter(Boolean)
    )
    .join(", ");
  const drinks = formData.drinks || "Non";

  // Message WhatsApp
  const message = `Ma Commande
*Récapitulatif* #${orderId}
${itemLines}

*ASSORTIMENTS*
*Complément(s)* : ${extrasSummary || "Aucun"}
*Boisson* : ${drinks}

*Détails de livraison*
*Numéro à appeler* : ${formattedPhone}
*Nom de la personne à appeler* : ${customerName}
*Date de livraison* : ${deliveryDate}
*Heure de livraison* : ${deliveryTime}
*Lieu de livraison* : ${deliveryLocation}

*TOTAL DE MA COMMANDE*
${formatPrice(total)} FCFA

*Suivez votre commande ici* : http://mangedabord.com/commande/me/${formattedPhone.replace("+", "")}`;

  return encodeURIComponent(message);
};

// Composant pour un ExtraList avec listes déroulantes
const ExtraListItem = memo(
  ({ extraList, item, index, handleExtraSelect, formatPrice }) => {
    console.log(`Rendu ExtraListItem ${extraList.id} pour item ${index}:`, {
      selectedExtra: item.extras?.[extraList.id],
    });

    const errorId = `extra-error-${extraList.id}-${index}`;
    const hasError = item.errors?.extras?.[extraList.id];

    return (
      <div className="flex flex-col justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <span className="block mb-2 font-semibold text-gray-800">
            {extraList.name}
            {extraList.required && <span className="text-red-500 ml-1">*</span>}
          </span>
          <select
            id={`extra-${extraList.id}-${index}`}
            className={`w-full p-2 border ${
              hasError ? "border-red-500" : "border-gray-300"
            } rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm`}
            value={item.extras?.[extraList.id]?.[0] ?? ""}
            onChange={(e) => handleExtraSelect(extraList.id, e.target.value, index)}
            aria-label={`Choisir ${extraList.name}`}
            aria-describedby={hasError ? errorId : undefined}
          >
            {!extraList.required && <option value="">Aucun</option>}
            {extraList.extraListElements?.map((opt, optIndex) => (
              <option key={`${extraList.id}-${optIndex}`} value={optIndex}>
                {opt.name} (+{formatPrice(opt.price)} FCFA)
              </option>
            ))}
          </select>
        </div>
        {hasError && (
          <p id={errorId} className="mt-2 text-red-500 text-xs">
            {item.errors.extras[extraList.id]}
          </p>
        )}
      </div>
    );
  }
);

const CreateOrderForm = ({
  restaurantId,
  items: propItems = [],
  menus: propMenus = [],
  extraLists: propExtraLists = [],
  setError,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setFormError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [selectedSizes, setSelectedSizes] = useState({});
  const [formData, setFormData] = useState({
    phone: "",
    name: "",
    address: { completeAddress: "", area: "", areaSearchQuery: "" },
    items: [
      {
        dishId: "",
        quantity: 1,
        searchQuery: "",
        menuId: "",
        extras: {},
        size: null,
      },
    ],
    deliveryFee: DEFAULT_DELIVERY_FEE,
    pointsUsed: 0,
    pointsReduction: 0,
    paymentMethod: "Cash",
    drinks: "Non",
    notes: "",
  });
  const [confirmedItems, setConfirmedItems] = useState([]);
  const [itemErrors, setItemErrors] = useState([{}]);
  const [quartiersList, setQuartiersList] = useState([]);
  const [filteredQuartiers, setFilteredQuartiers] = useState([]);
  const [items, setItems] = useState(propItems);
  const [menus, setMenus] = useState(propMenus);
  const [extraLists, setExtraLists] = useState(propExtraLists);
  const [filteredPhones, setFilteredPhones] = useState([]);
  const [phoneSearchTimeout, setPhoneSearchTimeout] = useState(null);

  // Initialisation des tailles par défaut
  useEffect(() => {
    if (items.length > 0) {
      const initialSizes = {};
      items.forEach(item => {
        if (item.priceType === "sizes" && item.sizes && Object.keys(item.sizes).length > 0) {
          initialSizes[item.id] = Object.keys(item.sizes)[0];
        }
      });
      setSelectedSizes(prev => ({ ...prev, ...initialSizes }));
    }
  }, [items]);

  // Charger les données (items, menus, extraLists)
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Récupération des données depuis Firestore...");
        if (!propItems.length || !propMenus.length || !propExtraLists.length) {
          const [itemsSnapshot, menusSnapshot, extrasSnapshot] =
            await Promise.all([
              getDocs(
                query(
                  collection(db, "items"),
                  where("restaurantId", "==", restaurantId)
                )
              ),
              getDocs(
                query(
                  collection(db, "menus"),
                  where("restaurantId", "==", restaurantId)
                )
              ),
              getDocs(
                query(
                  collection(db, "extraLists"),
                  where("restaurantId", "==", restaurantId)
                )
              ),
            ]);
          const fetchedItems = itemsSnapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              extraLists: doc.data().extraLists || [],
            }))
            .filter(item => {
              if (item.priceType === "sizes") {
                const isValid = item.sizes && Object.keys(item.sizes).length > 0;
                if (!isValid) {
                  console.warn(`Article ${item.id} ignoré : sizes invalide`, item.sizes);
                }
                return isValid;
              }
              return true;
            });
          const fetchedMenus = menusSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          const fetchedExtraLists = extrasSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            extraListElements: doc.data().extraListElements || [],
          }));
          console.log("Données récupérées:", {
            items: fetchedItems.length,
            menus: fetchedMenus.length,
            extraLists: fetchedExtraLists.length,
          });
          setItems(fetchedItems);
          setMenus(fetchedMenus);
          setExtraLists(fetchedExtraLists);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des données:", err);
        setFormError("Impossible de charger les données.");
        setError("Impossible de charger les données.");
      }
    };
    fetchData();
  }, [restaurantId, propItems, propMenus, propExtraLists, setError]);

  // Charger les quartiers
  useEffect(() => {
    const cachedQuartiers = localStorage.getItem("quartiers");
    if (cachedQuartiers) {
      console.log("Chargement des quartiers depuis le cache local");
      setQuartiersList(JSON.parse(cachedQuartiers));
    } else {
      const fetchQuartiers = async () => {
        try {
          console.log("Récupération des quartiers depuis Firestore...");
          const querySnapshot = await getDocs(collection(db, "quartiers"));
          const quartiersData = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name || "",
            fee: doc.data().fee || 0,
            ...doc.data(),
          }));
          console.log("Quartiers récupérés:", quartiersData.length);
          setQuartiersList(quartiersData);
          localStorage.setItem("quartiers", JSON.stringify(quartiersData));
        } catch (err) {
          console.error("Erreur lors du chargement des quartiers:", err);
          setFormError("Impossible de charger les quartiers.");
        }
      };
      fetchQuartiers();
    }
  }, []);

  // Filtrer les quartiers
  useEffect(() => {
    console.log("Filtrage des quartiers:", formData.address.areaSearchQuery);
    if (formData.address.areaSearchQuery?.length > 0) {
      const filtered = quartiersList.filter((q) =>
        q?.name
          ?.toLowerCase()
          ?.includes(formData.address.areaSearchQuery?.toLowerCase() ?? "")
      );
      console.log("Quartiers filtrés:", filtered.length);
      setFilteredQuartiers(filtered);
    } else {
      setFilteredQuartiers([]);
    }
  }, [formData.address.areaSearchQuery, quartiersList]);

  // Filtrer les numéros de téléphone et récupérer les points
  useEffect(() => {
    if (formData.phone.length < 3) {
      setFilteredPhones([]);
      setAvailablePoints(0);
      return;
    }

    if (phoneSearchTimeout) {
      clearTimeout(phoneSearchTimeout);
    }

    const timeout = setTimeout(async () => {
      try {
        console.log("Recherche de numéros pour:", formData.phone);
        const phoneVariations = normalizePhone(formData.phone);
        const usersSnapshot = await getDocs(collection(db, "usersRestau"));
        const users = usersSnapshot.docs
          .map((doc) => ({
            uid: doc.id,
            phone: doc.data().phone || "",
            name: doc.data().name || "Invité",
            points: doc.data().points || 0,
          }))
          .filter((user) =>
            phoneVariations.some((variation) =>
              user.phone.toLowerCase().includes(variation.toLowerCase())
            )
          )
          .slice(0, 5);
        console.log("Numéros filtrés:", users.length);
        setFilteredPhones(users);
        if (users.length === 1) {
          setAvailablePoints(users[0].points);
          console.log("Points disponibles:", users[0].points);
        } else {
          setAvailablePoints(0);
        }
      } catch (err) {
        console.error("Erreur lors de la recherche des numéros:", err);
        setFormError("Impossible de charger les suggestions de numéros.");
      }
    }, 300);

    setPhoneSearchTimeout(timeout);

    return () => clearTimeout(timeout);
  }, [formData.phone]);

  // Valider le numéro de téléphone
  const validatePhone = useCallback(() => {
    const errors = {};
    if (!formData.phone) {
      errors.phone = "Veuillez entrer un numéro de téléphone";
    } else if (!/^\+?[0-9]{9,15}$/.test(formData.phone)) {
      errors.phone = "Numéro invalide (9-15 chiffres, indicatif + optionnel)";
    }
    return errors;
  }, [formData.phone]);

  // Validation d'un article
  const validateItem = useCallback(
    (item, index) => {
      console.log(`Validation de l'item ${index}:`, {
        dishId: item.dishId,
        quantity: item.quantity,
        size: item.size,
        extras: item.extras,
      });
      const errors = {};
      if (!item.dishId) {
        errors.dishId = "Veuillez sélectionner un plat";
      } else {
        const foundItem = items.find((it) => it.id === item.dishId);
        if (!foundItem) {
          errors.dishId = "Plat invalide ou introuvable";
          console.warn(`Plat introuvable pour dishId: ${item.dishId}`);
        } else if (item.menuId && foundItem.menuId !== item.menuId) {
          errors.dishId = "Ce plat n'appartient pas au menu sélectionné";
          console.warn(
            `Plat ${item.dishId} ne correspond pas au menu ${item.menuId}`
          );
        } else if (foundItem.priceType === "sizes") {
          if (!item.size || !foundItem.sizes?.[item.size]) {
            errors.size = "Taille invalide pour ce plat";
            console.warn(`Taille ${item.size} invalide pour plat ${item.dishId}`);
          }
        }
      }
      if (item.quantity < 1) errors.quantity = "Quantité minimale : 1";
      errors.extras = {};
      extraLists.forEach((extraList) => {
        if (
          extraList.required &&
          (!item.extras[extraList.id] || item.extras[extraList.id].length === 0)
        ) {
          errors.extras[extraList.id] = `Veuillez sélectionner ${extraList.name}`;
        }
      });
      if (Object.keys(errors.extras).length === 0) delete errors.extras;
      console.log(`Erreurs pour l'item ${index}:`, errors);
      setItemErrors((prev) => {
        const newErrors = [...prev];
        newErrors[index] = errors;
        return newErrors;
      });
      return Object.keys(errors).length === 0;
    },
    [items, extraLists]
  );

  // Confirmer un article
  const confirmItem = useCallback(
    (index) => {
      console.log(`Confirmer l'article ${index}`);
      const item = formData.items[index];
      if (validateItem(item, index)) {
        setConfirmedItems((prev) => [...prev, item]);
        setFormData((prev) => ({
          ...prev,
          items: prev.items.filter((_, i) => i !== index),
        }));
        setItemErrors((prev) => prev.filter((_, i) => i !== index));
        console.log(`Plat confirmé pour index ${index}:`, item);
      }
    },
    [formData.items, validateItem]
  );

  // Gestion des changements
  const handleInputChange = useCallback(
    (e, field = null, index = null) => {
      if (field) {
        setFormData((prev) => {
          const newItems = [...prev.items];
          if (field === "dishId") {
            const selectedItem = items.find((it) => it.id === e.target.value);
            if (!selectedItem) {
              console.warn(`Plat non trouvé pour ID: ${e.target.value}`);
              return prev;
            }
            console.log(`Plat sélectionné pour l'item ${index}:`, {
              id: e.target.value,
              name: selectedItem.name,
            });
            newItems[index] = {
              ...newItems[index],
              dishId: e.target.value,
              dishName: selectedItem.name || "",
              size: selectedItem.priceType === "sizes" && selectedItem.sizes
                ? Object.keys(selectedItem.sizes)[0]
                : null,
              searchQuery: "",
            };
          } else if (field === "quantity") {
            newItems[index].quantity = Math.max(1, Number(e.target.value));
            console.log(
              `Quantité mise à jour pour l'item ${index}:`,
              newItems[index].quantity
            );
          } else if (field === "searchQuery") {
            newItems[index].searchQuery = e.target.value;
          } else if (field === "menuId") {
            newItems[index].menuId = e.target.value;
            newItems[index].dishId = "";
            newItems[index].searchQuery = "";
            newItems[index].size = null;
            console.log(`Menu sélectionné pour l'item ${index}:`, e.target.value);
          } else if (field === "size") {
            newItems[index].size = e.target.value;
            console.log(`Taille sélectionnée pour l'item ${index}:`, e.target.value);
          }
          validateItem(newItems[index], index);
          return { ...prev, items: newItems };
        });
      } else {
        const { name, value } = e.target;
        setFormData((prev) => {
          const newData = { ...prev, [name]: value };
          if (name === "pointsUsed") {
            const points = Math.max(0, Number(value));
            if (points > availablePoints) {
              console.warn(`Points utilisés (${points}) dépassent les points disponibles (${availablePoints})`);
              return prev;
            }
            newData.pointsUsed = points;
            newData.pointsReduction = points * 10;
            console.log("Points utilisés mis à jour:", {
              pointsUsed: points,
              pointsReduction: newData.pointsReduction,
            });
          } else if (name?.startsWith("address.")) {
            const addressField = name.split(".")[1];
            newData.address = { ...prev.address, [addressField]: value };
            console.log(`Champ d'adresse mis à jour: ${addressField}`, value);
          }
          return newData;
        });
      }
    },
    [items, availablePoints, validateItem]
  );

  // Gérer la sélection d'un extra
  const handleExtraSelect = useCallback(
    (extraListId, extraIndex, index) => {
      console.log(`handleExtraSelect appelé pour item ${index}:`, {
        extraListId,
        extraIndex,
      });
      setFormData((prev) => {
        const newItems = [...prev.items];
        const extraList = extraLists.find((el) => el.id === extraListId);
        if (!extraList) {
          console.warn(`ExtraList non trouvé: ${extraListId}`);
          return prev;
        }
        const currentExtras = { ...(newItems[index].extras || {}) };
        if (extraIndex === "") {
          delete currentExtras[extraListId];
          console.log(`Extra désélectionné: ${extraListId}`);
        } else {
          const parsedIndex = Number(extraIndex);
          if (!extraList.extraListElements[parsedIndex]) {
            console.warn(`Extra non trouvé: ${extraListId}-${extraIndex}`);
            return prev;
          }
          currentExtras[extraListId] = [parsedIndex];
          console.log(`Extra sélectionné: ${extraListId}-${extraIndex}`);
        }
        newItems[index].extras = currentExtras;
        console.log(`Extras mis à jour pour item ${index}:`, currentExtras);
        return { ...prev, items: newItems };
      });
      validateItem(formData.items[index], index);
    },
    [extraLists, formData.items, validateItem]
  );

  // Sélectionner un numéro de téléphone
  const handlePhoneSelect = useCallback(
    (phone) => {
      console.log("Numéro sélectionné:", phone);
      setFormData((prev) => ({
        ...prev,
        phone: phone.phone,
        name: phone.name,
      }));
      setAvailablePoints(phone.points || 0);
      setFilteredPhones([]);
    },
    []
  );

  // Réinitialiser la recherche de numéro
  const clearPhoneSearch = useCallback(() => {
    console.log("Réinitialisation de la recherche de numéro");
    setFormData((prev) => ({
      ...prev,
      phone: "",
      name: "",
    }));
    setAvailablePoints(0);
    setFilteredPhones([]);
  }, []);

  // Sélectionner un quartier
  const handleQuartierSelect = useCallback(
    (quartier) => {
      console.log("Quartier sélectionné:", {
        name: quartier.name,
        fee: quartier.fee,
      });
      setFormData((prev) => {
        const newFormData = {
          ...prev,
          address: {
            ...prev.address,
            area: quartier.name || "",
            areaSearchQuery: "",
          },
          deliveryFee: quartier.fee || DEFAULT_DELIVERY_FEE,
        };
        console.log("État formData.address après sélection:", newFormData.address);
        return newFormData;
      });
      setFilteredQuartiers([]);
    },
    []
  );

  // Réinitialiser la recherche de quartier
  const clearQuartierSearch = useCallback(() => {
    console.log("Réinitialisation de la recherche de quartier");
    setFormData((prev) => {
      const newFormData = {
        ...prev,
        address: { ...prev.address, areaSearchQuery: "", area: "" },
        deliveryFee: DEFAULT_DELIVERY_FEE,
      };
      console.log("État formData.address après réinitialisation:", newFormData.address);
      return newFormData;
    });
    setFilteredQuartiers([]);
  }, []);

  // Ajouter un nouvel article
  const addItem = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          dishId: "",
          quantity: 1,
          searchQuery: "",
          menuId: "",
          extras: {},
          size: null,
        },
      ],
    }));
    setItemErrors((prev) => [...prev, {}]);
    console.log("Nouvel item ajouté, total items:", formData.items.length + 1);
  }, []);

  // Supprimer un article
  const removeItem = useCallback((index, isConfirmed = false) => {
    if (isConfirmed) {
      setConfirmedItems((prev) => prev.filter((_, i) => i !== index));
      console.log(`Plat confirmé ${index} supprimé`);
    } else {
      setFormData((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
      setItemErrors((prev) => prev.filter((_, i) => i !== index));
      console.log(`Item ${index} supprimé`);
    }
  }, []);

  // Modifier un plat confirmé
  const editItem = useCallback((index) => {
    const item = confirmedItems[index];
    console.log(`Plat confirmé ${index} en modification:`, item);
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));
    setItemErrors((prev) => [...prev, {}]);
    setConfirmedItems((prev) => prev.filter((_, i) => i !== index));
  }, [confirmedItems]);

  // Calcul du prix d'un article individuel
  const calculateItemTotal = useCallback((item) => {
    const currentItem = items.find((it) => it.id === item.dishId);
    const isSizeBased = currentItem?.priceType === "sizes" && currentItem?.sizes && item.size;
    const itemPrice = isSizeBased
      ? convertPrice(currentItem.sizes[item.size])
      : convertPrice(currentItem?.price || 0);
    const extrasPrice = Object.entries(item.extras || {}).reduce(
      (extraSum, [extraListId, indexes]) => {
        const extraList = extraLists.find((el) => el.id === extraListId);
        return (
          extraSum +
          indexes.reduce((acc, index) => {
            const extra = extraList?.extraListElements[index];
            return acc + (extra?.price ? convertPrice(extra.price) : 0);
          }, 0)
        );
      },
      0
    );
    return (itemPrice + extrasPrice) * Number(item.quantity || 1);
  }, [items, extraLists]);

  // Calcul du total
  const calculateTotal = useCallback(() => {
    const allItems = [...formData.items, ...confirmedItems];
    const subtotal = allItems.reduce((sum, item) => {
      const currentItem = items.find((it) => it.id === item.dishId);
      const isSizeBased = currentItem?.priceType === "sizes" && currentItem?.sizes && item.size;
      const itemPrice = isSizeBased
        ? convertPrice(currentItem.sizes[item.size])
        : convertPrice(currentItem?.price || 0);
      const extrasPrice = Object.entries(item.extras || {}).reduce(
        (extraSum, [extraListId, indexes]) => {
          const extraList = extraLists.find((el) => el.id === extraListId);
          return (
            extraSum +
            indexes.reduce((acc, index) => {
              const extra = extraList?.extraListElements[index];
              return acc + (extra?.price ? convertPrice(extra.price) : 0);
            }, 0)
          );
        },
        0
      );
      return sum + (itemPrice + extrasPrice) * Number(item.quantity || 1);
    }, 0);
    const deliveryFee = Number(formData.deliveryFee) || DEFAULT_DELIVERY_FEE;
    const total = subtotal + deliveryFee - Number(formData.pointsReduction);
    console.log("Calcul du total:", {
      subtotal,
      deliveryFee,
      pointsReduction: formData.pointsReduction,
      total,
    });
    return total;
  }, [formData.items, formData.deliveryFee, formData.pointsReduction, confirmedItems, items, extraLists]);

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Début de la soumission du formulaire", { formData, confirmedItems, itemErrors });

    const phoneErrors = validatePhone();
    if (Object.keys(phoneErrors).length > 0) {
      console.log("Erreur de validation du téléphone:", phoneErrors);
      setFormError(phoneErrors.phone);
      setError(phoneErrors.phone);
      return;
    }

    if (!formData.address.completeAddress) {
      console.log("Adresse complète manquante");
      setFormError("Veuillez remplir l'adresse complète");
      setError("Veuillez remplir l'adresse complète");
      return;
    }

    if (!formData.address.area) {
      console.log("Aucun quartier sélectionné");
      setFormError("Veuillez sélectionner un quartier");
      setError("Veuillez sélectionner un quartier");
      return;
    }

    if (!formData.paymentMethod) {
      console.log("Aucun moyen de paiement sélectionné");
      setFormError("Veuillez sélectionner un moyen de paiement");
      setError("Veuillez sélectionner un moyen de paiement");
      return;
    }

    const allItems = [...formData.items, ...confirmedItems];
    if (allItems.length === 0) {
      console.log("Aucun plat sélectionné");
      setFormError("Veuillez ajouter au moins un plat");
      setError("Cannot add an order without items.");
      return;
    }

    const allItemsValid = allItems.every((item, index) => {
      validateItem(item, index);
      return !itemErrors[index]?.dishId && !itemErrors[index]?.quantity && !itemErrors[index]?.extras && !itemErrors[index]?.size;
    });
    if (!allItemsValid) {
      console.log("Certains items sont invalides:", itemErrors);
      setFormError("Veuillez sélectionner des plats valides.");
      setError("Please select valid items.");
      return;
    }

    try {
      setLoading(true);
      setFormError(null);
      console.log("Vérification de l'utilisateur...");

      const formattedPhone = normalizePhone(formData.phone).find((v) => v.startsWith("+")) || `+${formData.phone}`;
      const guestId = `guest-${formattedPhone}`;
      console.log("Numéro formaté:", formattedPhone, "guestId:", guestId);

      const userRef = doc(db, "usersRestau", guestId);
      const userSnap = await getDoc(userRef);
      let userId = guestId;

      if (!userSnap.exists()) {
        console.log("Utilisateur non trouvé, création d'un nouvel utilisateur...");
        await setDoc(userRef, {
          uid: guestId,
          name: formData.name || "Invité",
          phone: formattedPhone,
          isGuest: true,
          points: 0,
          createdAt: new Date(),
        });
        console.log("Utilisateur créé avec succès:", guestId);
      } else {
        console.log("Utilisateur existant.", userSnap.data());
      }

      const orderData = {
        restaurantId: restaurantId || "",
        userId,
        contact: { phone: formattedPhone, name: formData.name || "Invité" },
        address: {
          completeAddress: formData.address.completeAddress || "",
          area: formData.address.area || "",
        },
        items: allItems.map((item) => {
          const foundItem = items.find((it) => it.id === item.dishId);
          const isSizeBased = foundItem?.priceType === "sizes" && foundItem?.sizes && item.size;
          const price = isSizeBased
            ? Number(convertPrice(foundItem.sizes[item.size])) // Utilise le prix de la taille
            : convertPrice(foundItem?.price || 0);
          return {
            dishId: item.dishId || "",
            dishName: foundItem?.name || item.dishName || "",
            price: price,
            size: isSizeBased ? item.size : null,
            quantity: Number(item.quantity) || 1,
            extras: Object.entries(item.extras || {}).flatMap(
              ([extraListId, indexes]) => {
                const extraList = extraLists.find((el) => el.id === extraListId);
                if (!extraList) {
                  console.warn(`ExtraList introuvable pour ID: ${extraListId}`);
                  return [];
                }
                return indexes.map((index) => {
                  const extra = extraList?.extraListElements[index];
                  return {
                    id: `${extraListId}-${index}`,
                    name: extra?.name || "",
                    price: extra?.price ? Number(convertPrice(extra.price)) : 0,
                  };
                });
              }
            ),
          };
        }),
        deliveryFee: Number(formData.deliveryFee) || DEFAULT_DELIVERY_FEE,
        pointsUsed: Number(formData.pointsUsed) || 0,
        pointsReduction: Number(formData.pointsReduction) || 0,
        paymentMethod: formData.paymentMethod,
        drinks: formData.drinks,
        notes: formData.notes,
        status: "en_attente",
        timestamp: Timestamp.now(),
      };

      console.log("orderData prêt à être envoyé:", orderData);

      const docRef = await addDoc(collection(db, "orders"), orderData);
      console.log("Commande créée avec succès, ID:", docRef.id);

      // Générer et ouvrir le lien WhatsApp
      const total = calculateTotal();
      const whatsappMessage = generateWhatsAppMessage(formData, confirmedItems, items, extraLists, total, docRef.id);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone.replace('+', '')}&text=${whatsappMessage}`;
      window.open(whatsappUrl, "_blank");
      console.log("Lien WhatsApp généré:", whatsappUrl);

      setSuccess("Commande créée avec succès ! Un récapitulatif a été envoyé via WhatsApp.");
      setFormData({
        phone: "",
        name: "",
        address: { completeAddress: "", area: "", areaSearchQuery: "" },
        items: [
          {
            dishId: "",
            quantity: 1,
            searchQuery: "",
            menuId: "",
            extras: {},
            size: null,
          },
        ],
        deliveryFee: DEFAULT_DELIVERY_FEE,
        pointsUsed: 0,
        pointsReduction: 0,
        paymentMethod: "Cash",
        drinks: "Non",
        notes: "",
      });
      setConfirmedItems([]);
      setItemErrors([{}]);
      setFilteredQuartiers([]);
      setFilteredPhones([]);
      setAvailablePoints(0);
    } catch (err) {
      console.error("Erreur lors de la création de la commande:", err.message);
      setFormError(`Échec de la création de la commande: ${err.message}`);
      setError(`Échec de la création de la commande: ${err.message}`);
    } finally {
      setLoading(false);
      console.log("Fin de la soumission, état final:", { loading, error, success });
    }
  };

  const total = calculateTotal();

  return (
    <div className="w-full bg-white p-4 sm:p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-gray-800 mb-6">Nouvelle Commande</h3>
      {error && (
        <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>
      )}
      {success && (
        <p className="text-green-600 text-sm mb-4 bg-green-50 p-2 rounded">{success}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section Client */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Client</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Téléphone <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center space-x-2">
                <i className="fas fa-phone absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-400"></i>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  placeholder="Ex: +237123456789"
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={formData.phone}
                  onChange={(e) => handleInputChange(e)}
                  required
                  aria-label="Numéro de téléphone"
                />
                {formData.phone && (
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700"
                    onClick={clearPhoneSearch}
                    aria-label="Effacer le numéro"
                  >
                    ✕
                  </button>
                )}
              </div>
              {filteredPhones.length > 0 && (
                <div className="absolute z-10 bg-white w-full border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                  {filteredPhones.map((phone) => (
                    <div
                      key={phone.uid}
                      onClick={() => handlePhoneSelect(phone)}
                      onKeyDown={(e) => e.key === "Enter" && handlePhoneSelect(phone)}
                      className="p-2 hover:bg-blue-50 cursor-pointer text-sm transition-colors"
                      role="option"
                      tabIndex={0}
                    >
                      {phone.phone} ({phone.name}, {phone.points} points)
                    </div>
                  ))}
                </div>
              )}
              {filteredPhones.length === 0 && formData.phone.length >= 3 && (
                <p className="text-sm text-gray-500 mt-1">
                  Aucun numéro correspondant trouvé
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nom du client
              </label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Nom du client"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                value={formData.name}
                onChange={(e) => handleInputChange(e)}
                aria-label="Nom du client"
              />
            </div>
            <div>
              <label
                htmlFor="completeAddress"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Adresse complète <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="completeAddress"
                name="address.completeAddress"
                placeholder="Adresse complète"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={formData.address.completeAddress}
                onChange={(e) => handleInputChange(e)}
                required
                aria-label="Adresse complète"
              />
            </div>
            <div className="relative md:col-span-2">
              <label
                htmlFor="areaSearchQuery"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Quartier <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  id="areaSearchQuery"
                  name="address.areaSearchQuery"
                  placeholder="Rechercher un quartier..."
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={formData.address.areaSearchQuery}
                  onChange={(e) => handleInputChange(e)}
                  aria-label="Rechercher un quartier"
                />
                {formData.address.areaSearchQuery && (
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700"
                    onClick={clearQuartierSearch}
                    aria-label="Effacer la recherche"
                  >
                    ✕
                  </button>
                )}
              </div>
              {filteredQuartiers.length > 0 && (
                <div className="absolute z-10 bg-white w-full border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                  {filteredQuartiers.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => handleQuartierSelect(q)}
                      className="p-2 hover:bg-blue-50 cursor-pointer text-sm transition-colors"
                    >
                      {q.name} ({formatPrice(q.fee)} FCFA)
                    </div>
                  ))}
                </div>
              )}
              {filteredQuartiers.length === 0 && formData.address.areaSearchQuery && (
                <p className="text-sm text-gray-500 mt-1">
                  Aucun quartier trouvé
                </p>
              )}
              {formData.address.area && (
                <p className="text-sm text-gray-600 mt-2 bg-gray-100 p-2 rounded">
                  Quartier sélectionné : {formData.address.area} ({formatPrice(formData.deliveryFee)} FCFA)
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="drinks"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Boisson
              </label>
              <select
                id="drinks"
                name="drinks"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={formData.drinks}
                onChange={(e) => handleInputChange(e)}
                aria-label="Select drink"
              >
                <option value="Non">Non</option>
                <option value="Oui">Oui</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="paymentMethod"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Moyen de paiement <span className="text-red-500">*</span>
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={formData.paymentMethod}
                onChange={(e) => handleInputChange(e)}
                required
                aria-label="Select payment method"
              >
                <option value="Cash">Espèces</option>
                <option value="Mobile">Mobile</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Notes de la commande
              </label>
              <textarea
                id="notes"
                name="notes"
                placeholder="Instructions spéciales..."
                className="w-full p-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={formData.notes}
                onChange={(e) => handleInputChange(e)}
                aria-label="Order notes"
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="pointsUsed"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Points utilisés ({availablePoints} disponibles)
              </label>
              <input
                type="number"
                id="pointsUsed"
                name="pointsUsed"
                className={`w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  availablePoints === 0 ? "bg-gray-200 cursor-not-allowed" : ""
                }`}
                value={formData.pointsUsed}
                onChange={(e) => handleInputChange(e)}
                disabled={availablePoints === 0}
                aria-label="Points used"
              />
            </div>
          </div>
        </div>

        {/* Section Commandes */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Commandes</h4>
          {confirmedItems.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun plat confirmé</p>
          ) : (
            <div className="space-y-3">
              {confirmedItems.map((item, index) => {
                const currentItem = items.find((it) => it.id === item.dishId);
                const isSizeBased = currentItem?.priceType === "sizes" && currentItem?.sizes && item.size;
                const extrasDetails = Object.entries(item.extras || {}).map(
                  ([extraListId, indexes]) => {
                    const extraList = extraLists.find(
                      (el) => el.id === extraListId
                    );
                    return indexes.map((idx) => {
                      const extra = extraList?.extraListElements[idx];
                      return extra?.name || "";
                    }).join(", ");
                  }
                ).filter(Boolean).join("; ");
                return (
                  <div
                    key={index}
                    className="p-3 bg-white border border-gray-200 rounded-md flex justify-between items-center text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {currentItem?.name || "Plat inconnu"}{isSizeBased ? ` (${item.size})` : ""} x {item.quantity}
                      </p>
                      {extrasDetails && (
                        <p className="text-gray-600 text-xs">
                          Extras: {extrasDetails}
                        </p>
                      )}
                      <p className="text-gray-600">
                        {formatPrice(calculateItemTotal(item))} FCFA
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        className="bg-blue-600 text-white px-2 py-1 rounded-md text-xs hover:bg-blue-700"
                        onClick={() => editItem(index)}
                        aria-label="Edit item"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="bg-red-600 text-white px-2 py-1 rounded-md text-xs hover:bg-red-700"
                        onClick={() => removeItem(index, true)}
                        aria-label="Remove item"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section Ajouter des plats */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h4 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            Ajouter des plats
          </h4>
          <div className="space-y-6">
            {formData.items.map((item, index) => {
              const currentItem = items.find((it) => it.id === item.dishId);
              const isSizeBased = currentItem?.priceType === "sizes" && currentItem?.sizes;
              return (
                <div
                  key={index}
                  className="border border-gray-200 p-4 rounded-lg bg-gray-50 hover:bg-white transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label
                        htmlFor={`menu-${index}`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Menu
                      </label>
                      <select
                        id={`menu-${index}`}
                        className="flex items-center p-2 border border-gray-300 rounded-lg py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-blue-500"
                        value={item.menuId}
                        onChange={(e) => handleInputChange(e, "menuId", index)}
                        aria-label="Select menu"
                      >
                        <option value="">Tous les menus</option>
                        {menus.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="relative">
                      <label
                        htmlFor={`dish-${index}`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Plat <span className="text-red-500">*</span>
                      </label>
                      {item.dishId ? (
                        <div className="flex items-center justify-between p-2 border border-gray-300 rounded-lg bg-white text-sm">
                          <span>
                            {currentItem?.name || "Plat inconnu"}
                          </span>
                          <button
                            type="button"
                            className="text-indigo-600 hover:text-indigo-800"
                            onClick={() =>
                              handleInputChange(
                                { target: { value: "" } },
                                "dishId",
                                index
                              )
                            }
                            aria-label="Edit dish"
                          >
                            Modifier
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="text"
                            id={`dish-${index}`}
                            placeholder="Rechercher un plat..."
                            className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-blue-500 text-sm ${
                              itemErrors[index]?.dishId ? "border-red-500" : ""
                            }`}
                            value={item.searchQuery}
                            onChange={(e) => handleInputChange(e, "searchQuery", index)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && item.searchQuery) {
                                const match = items
                                  .filter((it) =>
                                    item.menuId ? it.menuId === item.menuId : true
                                  )
                                  .find((it) =>
                                    it.name
                                      .toLowerCase()
                                      .includes(item.searchQuery.toLowerCase())
                                  );
                                if (match)
                                  handleInputChange(
                                    { target: { value: match.id } },
                                    "dishId",
                                    index
                                  );
                              }
                            }}
                            aria-label="Search dish"
                          />
                          {itemErrors[index]?.dishId && (
                            <p className="text-red-500 text-xs mt-1">
                              {itemErrors[index].dishId}
                            </p>
                          )}
                          {item.searchQuery && (
                            <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg max-h-48 overflow-y-auto shadow-lg text-sm">
                              {items
                                .filter((it) =>
                                  item.menuId ? it.menuId === item.menuId : true
                                )
                                .filter((it) =>
                                  it.name
                                    .toLowerCase()
                                    .includes(item.searchQuery.toLowerCase())
                                )
                                .slice(0, 5)
                                .map((it) => (
                                  <li key={it.id}
                                    className="p-2 hover:bg-indigo-50 cursor-pointer flex items-center py-1 text-sm"
                                    onClick={() =>
                                      handleInputChange(
                                        { target: { value: it.id } },
                                        "dishId",
                                        index
                                      )
                                    }
                                  >
                                    {it.image && (
                                      <img
                                        src={it.image}
                                        alt={it.name}
                                        className="w-8 h-8 object-cover rounded mr-2"
                                        onError={(e) =>
                                          (e.target.src = "/img/default.png")
                                        }
                                      />
                                    )}
                                    <span>{it.name}</span>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                    {isSizeBased && (
                      <div>
                        <label
                          htmlFor={`size-${index}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Taille <span className="text-red-500">*</span>
                        </label>
                        <select
                          id={`size-${index}`}
                          className={`w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-blue-500 text-sm py-1 ${
                            itemErrors[index]?.size ? "border-red-500" : ""
                          }`}
                          value={item.size || ""}
                          onChange={(e) => handleInputChange(e, "size", index)}
                          disabled={!item.dishId}
                          aria-label="Select size"
                        >
                          {Object.keys(currentItem.sizes).map((size) => (
                            <option key={size} value={size}>
                              {size} ({formatPrice(currentItem.sizes[size])} FCFA)
                            </option>
                          ))}
                        </select>
                        {itemErrors[index]?.size && (
                          <p className="text-red-500 text-xs mt-1">
                            {itemErrors[index].size}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <label
                        htmlFor={`quantity-${index}`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Quantité <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id={`quantity-${index}`}
                        min="1"
                        className={`w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-blue-500 text-sm py-1 ${
                          itemErrors[index]?.quantity ? "border-red-500" : ""
                        }`}
                        value={item.quantity}
                        onChange={(e) => handleInputChange(e, "quantity", index)}
                        required
                        aria-label="Quantity"
                      />
                      {itemErrors[index]?.quantity && (
                        <p className="text-red-500 text-xs mt-1">
                          {itemErrors[index].quantity}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Extras
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {extraLists.length > 0 ? (
                        extraLists.map((el) => (
                          <ExtraListItem
                            key={el.id}
                            extraList={el}
                            item={{ ...item, errors: itemErrors[index] || {} }}
                            index={index}
                            handleExtraSelect={handleExtraSelect}
                            formatPrice={formatPrice}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 col-span-full">
                          Aucun extra disponible
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    Total pour cet article : {formatPrice(calculateItemTotal(item))} FCFA
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-800 text-sm"
                        onClick={() => removeItem(index)}
                        aria-label="Remove item"
                      >
                        Supprimer
                      </button>
                    )}
                    <button
                      type="button"
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      onClick={() => confirmItem(index)}
                      disabled={
                        !item.dishId ||
                        item.quantity < 1 ||
                        (isSizeBased && !item.size) ||
                        extraLists.some(
                          (el) =>
                            el.required &&
                            (!item.extras[el.id] || item.extras[el.id].length === 0)
                        )
                      }
                      aria-label="Confirm item"
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none"
              aria-label="Add another dish"
            >
              + Ajouter un autre plat
            </button>
          </div>
        </div>

        {/* Section Résumé */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Résumé</h4>
          <div className="space-y-3 text-sm">
            {confirmedItems.length > 0 && (
              <>
                <h5 className="font-medium text-gray-700">Plats confirmés</h5>
                <div className="space-y-2">
                  {confirmedItems.map((item, index) => {
                    const currentItem = items.find((it) => it.id === item.dishId);
                    const isSizeBased = currentItem?.priceType === "sizes" && currentItem?.sizes && item.size;
                    const extrasDetails = Object.entries(item.extras || {}).map(
                      ([extraListId, indexes]) => {
                        const extraList = extraLists.find(
                          (el) => el.id === extraListId
                        );
                        return indexes.map((idx) => {
                          const extra = extraList?.extraListElements[idx];
                          return extra?.name || "";
                        }).join(",");
                      }
                    ).filter(Boolean).join("; ");
                    return (
                      <div
                        key={index}
                        className="p-2 bg-white border border-gray-200 rounded-md text-sm py-1"
                      >
                        <p>
                          {currentItem?.name || "Plat non sélectionné"}{isSizeBased ? ` (${item.size})` : ""} x {item.quantity}
                        </p>
                        {extrasDetails && (
                          <p className="text-xs">Extras: {extrasDetails}</p>
                        )}
                        <p>{formatPrice(calculateItemTotal(item))} FCFA</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {formData.items.length > 0 && (
              <>
                <h5 className="font-medium text-gray-700">Plats en cours de sélection</h5>
                <div className="space-y-2">
                  {formData.items.map((item, index) => {
                    const currentItem = items.find((it) => it.id === item.dishId);
                    const isSizeBased = currentItem?.priceType === "sizes" && currentItem?.sizes && item.size;
                    const extrasDetails = Object.entries(item.extras || {}).map(
                      ([extraListId, indexes]) => {
                        const extraList = extraLists.find(
                          (el) => el.id === extraListId
                        );
                        return indexes.map((idx) => {
                          const extra = extraList?.extraListElements[idx];
                          return extra?.name || "";
                        }).join(",");
                      }
                    ).filter(Boolean).join("; ");
                    return (
                      <div
                        key={index}
                        className="p-2 bg-gray-100 border border-gray-200 rounded-md text-sm py-1"
                      >
                        <p>
                          {currentItem?.name || "Plat non sélectionné"}{isSizeBased ? ` (${item.size})` : ""} x {item.quantity}
                        </p>
                        {extrasDetails && (
                          <p className="text-xs">Extras: {extrasDetails}</p>
                        )}
                        <p>{formatPrice(calculateItemTotal(item))} FCFA</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span>Sous-total :</span>
              <span>
                {formatPrice(
                  [...formData.items, ...confirmedItems].reduce((sum, item) => {
                    const currentItem = items.find((it) => it.id === item.dishId);
                    const isSizeBased = currentItem?.priceType === "sizes" && currentItem?.sizes && item.size;
                    const itemPrice = isSizeBased
                      ? convertPrice(currentItem.sizes[item.size])
                      : convertPrice(currentItem?.price || 0);
                    const extrasPrice = Object.entries(item.extras || {}).reduce(
                      (extraSum, entry) => {
                        const [extraListId, indexes] = entry;
                        const extraList = extraLists.find(
                          (el) => el.id === extraListId
                        );
                        return (
                          extraSum +
                          indexes.reduce((acc, index) => {
                            const extra = extraList?.extraListElements[index];
                            return (
                              acc +
                              (extra?.price ? convertPrice(extra.price) : 0)
                            );
                          }, 0)
                        );
                      },
                      0
                    );
                    return (
                      sum + (itemPrice + extrasPrice) * Number(item.quantity || 1)
                    );
                  }, 0)
                )} FCFA
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Frais de livraison :</span>
              <input
                type="number"
                name="deliveryFee"
                className="w-20 p-2 border border-gray-300 rounded-md text-sm py-1 focus:ring-blue-500 focus:ring-2 focus:border-blue-500"
                value={formData.deliveryFee}
                onChange={(e) => handleInputChange(e)}
                aria-label="Delivery fee"
              />
            </div>
            <div className="flex justify-between items-center">
              <span>Points utilisés :</span>
              <input
                type="number"
                name="pointsUsed"
                className={`w-20 p-2 border border-gray-300 rounded-md text-sm py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  availablePoints === 0 ? "bg-gray-200 cursor-not-allowed" : ""
                }`}
                value={formData.pointsUsed}
                onChange={(e) => handleInputChange(e)}
                disabled={availablePoints === 0}
                aria-label="Points used"
              />
            </div>
            <div className="flex justify-between">
              <span>Réduction des points :</span>
              <span>{formatPrice(formData.pointsReduction)} FCFA</span>
            </div>
            <div className="flex justify-between font-semibold text-green-600">
              <span>Total :</span>
              <span>{formatPrice(total)} FCFA</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          disabled={
            loading ||
            !formData.phone ||
            !formData.address.completeAddress ||
            !formData.paymentMethod ||
            [...formData.items, ...confirmedItems].length === 0
          }
          aria-label="Create order"
        >
          {loading ? (
            <span className="flex items-center">
              <svg
                className="animate-spin h-5 w-5 mr-2 text-white"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
                />
              </svg>
              Création...
            </span>
          ) : (
            "Créer la commande"
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateOrderForm;