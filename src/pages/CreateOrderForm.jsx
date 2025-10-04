import { useState, useEffect, useCallback, memo, useMemo, useRef } from "react";
import { Plus, Check } from "lucide-react";
import { db } from "../firebase";
import useMenus from "../hooks/useMenus";
import { collection, addDoc, Timestamp, getDocs, query, where, doc, setDoc, getDoc } from "firebase/firestore";
import { formatPrice } from "../utils/orderUtils";

// Base URL for public links
// Prefer current origin when running in browser (works locally and online),
// fallback to env, then default production domain
const BASE_URL = (typeof window !== 'undefined' && window.location?.origin)
  || process.env.REACT_APP_PUBLIC_BASE_URL
  || "https://mangedabord.com";

const DEFAULT_DELIVERY_FEE = 1000;

// Normalise les prix
const convertPrice = (price) => {
  if (!price) return 0;
  try {
    return typeof price === "string" ? parseFloat(price.replace(/\./g, "")) || 0 : Number(price) || 0;
  } catch (err) {
    console.warn("Erreur dans convertPrice:", err);
    return 0;
  }
};

// Normalise les numéros de téléphone
const normalizePhone = (input) => {
  const cleaned = input.replace(/[\D\s]/g, "");
  return [
    `+237${cleaned.replace(/^237/, "")}`,
    cleaned,
    `+${cleaned}`,
    cleaned.replace(/^237/, ""),
    input,
  ].filter((v, i, arr) => v && arr.indexOf(v) === i && v.length >= 9);
};

// Génère le message WhatsApp
const generateWhatsAppMessage = (formData, selectedDishes, items, extraLists, total, { paymentUrl = null, ordersLink = null } = {}) => {
  const deliveryDate = new Date().toLocaleDateString("fr-FR");
  const deliveryTime = "Le plus tôt possible";
  const deliveryLocation = `${formData.area} | ${formatPrice(formData.deliveryFee)} FCFA`;
  const formattedPhone = normalizePhone(formData.phone).find((v) => v.startsWith("+")) || `+${formData.phone}`;

  const itemLines = Object.entries(selectedDishes)
    .filter(([_, data]) => data.quantity > 0)
    .map(([dishId, dishData]) => {
      const currentItem = items.find((it) => it.id === dishId);
      const itemName = currentItem?.name || "Plat inconnu";
      const size = dishData.size || null;
      const isSizeBased = currentItem?.priceType === "sizes" && currentItem?.sizes && size;
      const itemPrice = isSizeBased ? convertPrice(currentItem.sizes[size]) : convertPrice(currentItem?.price || 0);
      const extrasDetails = Object.entries(dishData.extras || {})
        .map(([extraListId, indexes]) => {
          const extraList = extraLists.find((el) => el.id === extraListId);
          return indexes.map((idx) => extraList?.extraListElements[idx]?.name || "").join(", ");
        })
        .filter(Boolean)
        .join("; ");
      const extrasPrice = Object.entries(dishData.extras || {}).reduce(
        (sum, [extraListId, indexes]) => {
          const extraList = extraLists.find((el) => el.id === extraListId);
          return sum + indexes.reduce((acc, idx) => acc + (extraList?.extraListElements[idx]?.price ? convertPrice(extraList.extraListElements[idx].price) : 0), 0);
        }, 0
      );
      const itemTotal = (itemPrice + extrasPrice) * dishData.quantity;
      return `*${itemName}${isSizeBased ? ` (${size})` : ""}* : ${formatPrice(itemTotal)} FCFA = ${dishData.quantity}${extrasDetails ? ` + ${extrasDetails}` : ""}`;
    }).join("\n");

  const extrasSummary = Object.entries(selectedDishes)
    .filter(([_, data]) => data.quantity > 0)
    .flatMap(([_, dishData]) => Object.entries(dishData.extras || {})
      .map(([extraListId, indexes]) => {
        const extraList = extraLists.find((el) => el.id === extraListId);
        return indexes.map((idx) => extraList?.extraListElements[idx]?.name || "");
      })
      .filter(Boolean)
    ).join(", ");

  // Section paiement: si lien de paiement direct disponible on peut l'afficher, sinon on redirige vers la page commande (ordersLink)
  const paymentSection = paymentUrl
    ? `\n*Paiement*\nEffectuez le paiement ici : ${paymentUrl}`
    : ordersLink
    ? `\n*Paiement*\nRendez-vous ici pour payer et suivre votre commande : ${ordersLink}`
    : `\n*Paiement*\nMéthode : ${formData.paymentMethod}`;

  const message = `Ma Commande
*Récapitulatif*
${itemLines}

*ASSORTIMENTS*
*Complément(s)* : ${extrasSummary || "Aucun"}

*Détails de livraison*
*Numéro* : ${formattedPhone}
*Date* : ${deliveryDate}
*Heure* : ${deliveryTime}
*Lieu* : ${deliveryLocation}

${paymentSection}

*TOTAL*
${formatPrice(total)} FCFA

*Payer et suivre votre commande* : ${ordersLink || `${BASE_URL}/me/${encodeURIComponent(formattedPhone)}/pay`}`;

  return encodeURIComponent(message);
};

// Safe clipboard copy with fallback for non-secure contexts/browsers
const copyToClipboard = async (text) => {
  try {
    if (window?.navigator?.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // continue to fallback
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
};

// Modal d'options (tailles / extras)
const ItemOptionsModal = memo(({ item, dishData, onUpdateDish, onClose, extraLists }) => {
  const [temp, setTemp] = useState(dishData);
  const lists = (item.extraLists || []).map((id) => extraLists.find((el) => el.id === id)).filter(Boolean);
  const isSizeBased = item.priceType === "sizes" && item.sizes;

  const selectSize = (sz) => setTemp((p) => ({ ...p, size: sz }));
  const selectExtra = (listId, idx) =>
    setTemp((p) => ({
      ...p,
      extras: { ...(p.extras || {}), [listId]: idx === "" ? undefined : [Number(idx)] },
    }));
  const changeQty = (d) => setTemp((p) => ({ ...p, quantity: Math.max(1, (p.quantity || 1) + d) }));
  const save = () => {
    onUpdateDish(item.id, temp);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full max-h-[80vh] bg-gray-800 rounded-t-xl overflow-y-auto">
        <div className="px-4 py-3 bg-gray-700 flex items-center justify-between">
          <h3 className="text-white font-medium">{item.name}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Taille */}
          {isSizeBased && (
            <div>
              <h4 className="text-white font-medium mb-2">Taille</h4>
              <div className="space-y-2">
                {Object.entries(item.sizes).map(([size, price]) => (
                  <label key={size} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                    <div className="relative overflow-visible flex items-center">
                      <input
                        type="radio"
                        name="size"
                        value={size}
                        checked={temp.size === size}
                        onChange={() => selectSize(size)}
                        className="mr-3"
                      />
                      <span className="text-white">{size}</span>
                    </div>
                    <span className="text-gray-300">{formatPrice(price)} FCFA</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Extras */}
          {lists.map((list) => (
            <div key={list.id}>
              <h4 className="text-white font-medium mb-2">
                {list.name}
                {list.required && <span className="text-red-400 ml-1">*</span>}
              </h4>
              <div className="space-y-2">
                {!list.required && (
                  <label className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name={`extra-${list.id}`}
                        value=""
                        checked={!temp.extras?.[list.id]}
                        onChange={() => selectExtra(list.id, "")}
                        className="mr-3"
                      />
                      <span className="text-white">Aucun</span>
                    </div>
                  </label>
                )}
                {list.extraListElements?.map((opt, idx) => (
                  <label key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name={`extra-${list.id}`}
                        value={idx}
                        checked={temp.extras?.[list.id]?.[0] === idx}
                        onChange={() => selectExtra(list.id, idx)}
                        className="mr-3"
                      />
                      <span className="text-white">{opt.name}</span>
                    </div>
                    <span className="text-gray-300">+{formatPrice(opt.price)} FCFA</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Quantité */}
          <div>
            <h4 className="text-white font-medium mb-2">Quantité</h4>
            <div className="flex items-center justify-center gap-4 bg-gray-700 rounded-lg p-3">
              <button onClick={() => changeQty(-1)} className="w-10 h-10 rounded-full bg-gray-600 text-white disabled:opacity-50" disabled={(temp.quantity || 1) <= 1}>-</button>
              <span className="text-white text-xl w-10 text-center">{temp.quantity || 1}</span>
              <button onClick={() => changeQty(1)} className="w-10 h-10 rounded-full bg-gray-600 text-white">+</button>
            </div>
          </div>

          {/* Prix personnalisé */}
          <div>
            <h4 className="text-white font-medium mb-2">Prix personnalisé (optionnel)</h4>
            <div className="bg-gray-700 rounded-lg p-3">
              <input
                type="number"
                value={temp.customPrice || ""}
                onChange={(e) => setTemp(p => ({ ...p, customPrice: e.target.value === "" ? null : Number(e.target.value) }))}
                placeholder="Laisser vide pour prix normal"
                className="w-full bg-gray-600 text-white rounded px-3 py-2 placeholder-gray-400"
                min="0"
                step="100"
              />
              <p className="text-gray-400 text-sm mt-1">FCFA - Remplace le prix par défaut</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-lg">Annuler</button>
            <button onClick={save} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg">Ajouter au panier</button>
          </div>
        </div>
      </div>
    </div>
  );
});

// Composant ExtraListItem
const ExtraListItem = memo(({ extraList, dishData, dishId, handleExtraSelect, formatPrice, errors }) => (
  <fieldset className="mt-2">
    <legend className="text-sm font-medium text-gray-700">
      {extraList.name}
      {extraList.required && <span className="text-red-500">*</span>}
    </legend>
    <div className="flex flex-wrap gap-2 mt-1">
      {!extraList.required && (
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="radio"
            name={`extra-${extraList.id}-${dishId}`}
            value=""
            checked={!dishData.extras?.[extraList.id]}
            onChange={(e) => handleExtraSelect(extraList.id, e.target.value, dishId)}
            className="form-radio text-blue-500"
          />
          <span className="ml-1 text-sm text-gray-600">Aucun</span>
        </label>
      )}
      {extraList.extraListElements?.map((opt, idx) => (
        <label key={`${extraList.id}-${idx}`} className="inline-flex items-center cursor-pointer">
          <input
            type="radio"
            name={`extra-${extraList.id}-${dishId}`}
            value={idx}
            checked={dishData.extras?.[extraList.id]?.[0] === idx}
            onChange={(e) => handleExtraSelect(extraList.id, e.target.value, dishId)}
            className="form-radio text-blue-500"
          />
          <span className="ml-1 text-sm text-gray-600">
            {opt.name} (+{formatPrice(opt.price)} FCFA)
          </span>
        </label>
      ))}
    </div>
    {errors?.extras?.[extraList.id] && (
      <p className="text-red-500 text-xs mt-1">{errors.extras[extraList.id]}</p>
    )}
  </fieldset>
));

const CreateOrderForm = ({ restaurantId, items: propItems = [], menus: propMenus = [], extraLists: propExtraLists = [], setError = () => {}, showTitle = true }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setFormError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({
    phone: "",
    area: "",
    areaSearchQuery: "",
    deliveryFee: DEFAULT_DELIVERY_FEE,
    paymentMethod: "Cash",
  });
  const [selectedDishes, setSelectedDishes] = useState({});
  const [dishErrors, setDishErrors] = useState({});
  const [quartiersList, setQuartiersList] = useState([]);
  const [filteredQuartiers, setFilteredQuartiers] = useState([]);
  const [items, setItems] = useState(propItems);
  const [menus, setMenus] = useState(propMenus);
  const [extraLists, setExtraLists] = useState(propExtraLists);
  const [filteredPhones, setFilteredPhones] = useState([]);
  const [phoneSearchTimeout, setPhoneSearchTimeout] = useState(null);
  const [copied, setCopied] = useState(false);
  const [menuFilter, setMenuFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState("");
  const [orderId, setOrderId] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [publicOrderLink, setPublicOrderLink] = useState("");
  const [copiedPaymentLink, setCopiedPaymentLink] = useState(false);
  const [phoneListPosition, setPhoneListPosition] = useState("below");
  const phoneInputRef = useRef(null);
  const [showItemModal, setShowItemModal] = useState(null); // { item, dishData }
  const [customDiscount, setCustomDiscount] = useState(0);
  const [customTotal, setCustomTotal] = useState(null);
  const [paymentSplit, setPaymentSplit] = useState({ cash: 0, mobile: 0 });

  // Reuse the same data source as Accueil via useMenus
  const { items: hookItems, menus: hookMenus, extraLists: hookExtraLists, loading: hookLoading } = useMenus();

  // Filtrage des items
  const filteredItems = useMemo(() => items.filter((item) => (
    (!menuFilter || item.menuId === menuFilter) &&
    (!searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )), [items, menuFilter, searchQuery]);

  // Initialisation des tailles
  useEffect(() => {
    if (items.length > 0) {
      setSelectedDishes((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((dishId) => {
          const item = items.find((it) => it.id === dishId);
          if (item?.priceType === "sizes" && item.sizes && !updated[dishId].size) {
            updated[dishId].size = Object.keys(item.sizes)[0];
          }
        });
        return updated;
      });
    }
  }, [items]);

  // Synchronize with useMenus when props are empty
  useEffect(() => {
    if (!propItems.length && hookItems?.length) setItems(hookItems);
  }, [propItems.length, hookItems]);
  useEffect(() => {
    if (!propMenus.length && hookMenus?.length) setMenus(hookMenus);
  }, [propMenus.length, hookMenus]);
  useEffect(() => {
    if (!propExtraLists.length && hookExtraLists?.length) setExtraLists(hookExtraLists);
  }, [propExtraLists.length, hookExtraLists]);

  // Charger les quartiers
  useEffect(() => {
    const cachedQuartiers = localStorage.getItem("quartiers");
    if (cachedQuartiers) {
      const parsed = JSON.parse(cachedQuartiers);
      const uniqueQuartiers = Array.from(new Map(parsed.map((q) => [q.id, q])).values());
      setQuartiersList(uniqueQuartiers);
    } else {
      const fetchQuartiers = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, "quartiers"));
          const quartiersData = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name || "",
            fee: doc.data().fee || 0,
            ...doc.data(),
          }));
          const uniqueQuartiers = Array.from(new Map(quartiersData.map((q) => [q.id, q])).values());
          if (uniqueQuartiers.length !== quartiersData.length) {
            console.warn("Doublons détectés dans les quartiers:", quartiersData);
          }
          setQuartiersList(uniqueQuartiers);
          localStorage.setItem("quartiers", JSON.stringify(uniqueQuartiers));
        } catch (err) {
          setFormError("Impossible de charger les quartiers.");
        }
      };
      fetchQuartiers();
    }
  }, []);

  // Filtrer les quartiers
  useEffect(() => {
    const uniqueQuartiers = Array.from(new Map(quartiersList.map((q) => [q.id, q])).values());
    setFilteredQuartiers(
      formData.areaSearchQuery
        ? uniqueQuartiers.filter((q) =>
            q?.name?.toLowerCase()?.includes(formData.areaSearchQuery.toLowerCase() ?? "")
          )
        : []
    );
  }, [formData.areaSearchQuery, quartiersList]);

  // Filtrer les numéros
  useEffect(() => {
    if (formData.phone.length < 3) {
      setFilteredPhones([]);
      setPhoneListPosition("below");
      return;
    }
    if (phoneSearchTimeout) clearTimeout(phoneSearchTimeout);
    const timeout = setTimeout(async () => {
      try {
        const phoneVariations = normalizePhone(formData.phone);
        const usersSnapshot = await getDocs(collection(db, "usersRestau"));
        const users = usersSnapshot.docs
          .map((doc) => ({ uid: doc.id, phone: doc.data().phone || "", points: doc.data().points || 0 }))
          .filter((user) => phoneVariations.some((variation) => user.phone.toLowerCase().includes(variation.toLowerCase())))
          .slice(0, 5);
        setFilteredPhones(users);

        // Calculer la position de la liste déroulante
        if (phoneInputRef.current && users.length > 0) {
          const inputRect = phoneInputRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - inputRect.bottom;
          const spaceAbove = inputRect.top;
          const dropdownHeight = Math.min(users.length * 40, 192); // Estimation: 40px par élément, max 192px (max-h-48)
          setPhoneListPosition(spaceBelow < dropdownHeight && spaceAbove > dropdownHeight ? "above" : "below");
        }
      } catch (err) {
        setFormError("Impossible de charger les suggestions de numéros.");
      }
    }, 300);
    setPhoneSearchTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [formData.phone]);

  // Valider le numéro
  const validatePhone = useCallback(() => {
    const errors = {};
    if (!formData.phone) errors.phone = "Numéro de téléphone requis";
    else if (!/^\+?[0-9]{9,15}$/.test(formData.phone)) errors.phone = "Numéro invalide (9-15 chiffres)";
    return errors;
  }, [formData.phone]);

  // Valider un plat
  const validateDish = useCallback((dishId, dishData) => {
    const errors = {};
    const item = items.find((it) => it.id === dishId);
    if (!item) {
      errors.dishId = "Plat invalide";
      setDishErrors((prev) => ({ ...prev, [dishId]: errors }));
      return false;
    }
    if (dishData.quantity < 1) errors.quantity = "Quantité minimale : 1";
    if (item.priceType === "sizes" && (!dishData.size || !item.sizes?.[dishData.size])) errors.size = "Taille invalide";
    const dishExtraListIds = item.extraLists || [];
    const dishExtraLists = extraLists.filter((el) => dishExtraListIds.includes(el.id));
    if (dishExtraLists.length > 0) {
      const requiredExtraErrors = {};
      dishExtraLists.forEach((list) => {
        if (list.required && (!dishData.extras?.[list.id] || dishData.extras[list.id].length === 0)) {
          requiredExtraErrors[list.id] = `Sélectionnez un ${list.name}`;
        }
      });
      if (Object.keys(requiredExtraErrors).length > 0) errors.extras = requiredExtraErrors;
    }
    setDishErrors((prev) => ({ ...prev, [dishId]: errors }));
    return Object.keys(errors).length === 0;
  }, [items, extraLists]);

  // Gestion des inputs
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Gérer la quantité
  const handleQuantityChange = useCallback((dishId, newQuantity) => {
    const qty = Math.max(0, Number(newQuantity));
    setSelectedDishes((prev) => {
      const updated = { ...prev };
      if (qty === 0) {
        delete updated[dishId];
        setDishErrors((errPrev) => {
          const newErr = { ...errPrev };
          delete newErr[dishId];
          return newErr;
        });
      } else {
        if (!updated[dishId]) {
          const item = items.find((it) => it.id === dishId);
          updated[dishId] = {
            quantity: qty,
            size: item?.priceType === "sizes" && item?.sizes ? Object.keys(item.sizes)[0] : null,
            extras: {},
            customPrice: null, // Prix personnalisé
          };
        } else {
          updated[dishId].quantity = qty;
        }
        validateDish(dishId, updated[dishId]);
      }
      return updated;
    });
  }, [items, validateDish]);

  // Gérer le prix personnalisé
  const handleCustomPriceChange = useCallback((dishId, newPrice) => {
    setSelectedDishes((prev) => {
      const updated = { ...prev };
      if (updated[dishId]) {
        updated[dishId].customPrice = newPrice === "" ? null : Math.max(0, Number(newPrice) || 0);
        validateDish(dishId, updated[dishId]);
      }
      return updated;
    });
  }, [validateDish]);

  // Gérer la taille
  const handleSizeChange = useCallback((dishId, newSize) => {
    setSelectedDishes((prev) => {
      const updated = { ...prev };
      if (updated[dishId]) {
        updated[dishId].size = newSize;
        validateDish(dishId, updated[dishId]);
      }
      return updated;
    });
  }, [validateDish]);

  // Gérer les extras
  const handleExtraSelect = useCallback((extraListId, extraIndex, dishId) => {
    setSelectedDishes((prev) => {
      const updated = { ...prev };
      if (!updated[dishId]) return prev;
      const currentExtras = { ...(updated[dishId].extras || {}) };
      if (extraIndex === "") {
        delete currentExtras[extraListId];
      } else {
        const parsedIndex = Number(extraIndex);
        const extraList = extraLists.find((el) => el.id === extraListId);
        if (!extraList || !extraList.extraListElements[parsedIndex]) return prev;
        currentExtras[extraListId] = [parsedIndex];
      }
      updated[dishId].extras = currentExtras;
      validateDish(dishId, updated[dishId]);
      return updated;
    });
  }, [extraLists, validateDish]);

  // Sélectionner un numéro
  const handlePhoneSelect = useCallback((phone) => {
    setFormData((prev) => ({ ...prev, phone: phone.phone }));
    setFilteredPhones([]);
    setPhoneListPosition("below");
  }, []);

  // Réinitialiser la recherche de numéro
  const clearPhoneSearch = useCallback(() => {
    setFormData((prev) => ({ ...prev, phone: "" }));
    setFilteredPhones([]);
    setPhoneListPosition("below");
  }, []);

  // Sélectionner un quartier
  const handleQuartierSelect = useCallback((quartier) => {
    setFormData((prev) => ({ ...prev, area: quartier.name || "", areaSearchQuery: "", deliveryFee: quartier.fee || DEFAULT_DELIVERY_FEE }));
    setFilteredQuartiers([]);
  }, []);

  // Réinitialiser la recherche de quartier
  const clearQuartierSearch = useCallback(() => {
    setFormData((prev) => ({ ...prev, areaSearchQuery: "", area: "", deliveryFee: DEFAULT_DELIVERY_FEE }));
    setFilteredQuartiers([]);
  }, []);

  // Calcul du prix d'un plat
  const calculateDishTotal = useCallback((dishId, dishData) => {
    const item = items.find((it) => it.id === dishId);
    if (!item || dishData.quantity < 1) return 0;
    
    // Utiliser le prix personnalisé s'il existe, sinon le prix normal
    let itemPrice;
    if (dishData.customPrice !== null && dishData.customPrice !== undefined) {
      itemPrice = convertPrice(dishData.customPrice);
    } else {
      const isSizeBased = item?.priceType === "sizes" && item?.sizes && dishData.size;
      itemPrice = isSizeBased ? convertPrice(item.sizes[dishData.size]) : convertPrice(item?.price || 0);
    }
    
    const extrasPrice = Object.entries(dishData.extras || {}).reduce(
      (sum, [extraListId, indexes]) => sum + indexes.reduce((acc, index) => {
        const extraList = extraLists.find((el) => el.id === extraListId);
        return acc + (extraList?.extraListElements[index]?.price ? convertPrice(extraList.extraListElements[index].price) : 0);
      }, 0), 0
    );
    return (itemPrice + extrasPrice) * Number(dishData.quantity || 1);
  }, [items, extraLists]);

  // Calcul du total
  const calculateTotal = useCallback(() => {
    const subtotal = Object.entries(selectedDishes).reduce((sum, [dishId, dishData]) => sum + (dishData.quantity < 1 ? 0 : calculateDishTotal(dishId, dishData)), 0);
    const totalWithDelivery = subtotal + Number(formData.deliveryFee || DEFAULT_DELIVERY_FEE);
    
    // Appliquer réduction personnalisée ou total personnalisé
    if (customTotal !== null && customTotal >= 0) {
      return customTotal;
    } else if (customDiscount > 0) {
      return Math.max(0, totalWithDelivery - customDiscount);
    }
    
    return totalWithDelivery;
  }, [selectedDishes, formData.deliveryFee, calculateDishTotal, customDiscount, customTotal]);

  // Obtenir les items
  const getAllItems = useCallback(() => Object.entries(selectedDishes).filter(([_, data]) => data.quantity > 0).map(([dishId, data]) => ({ dishId, ...data })), [selectedDishes]);

  // Passer à l'étape suivante
  const goToNextStep = () => {
    const allItems = getAllItems();
    if (allItems.length === 0) {
      setFormError("Sélectionnez au moins un plat.");
      return;
    }
    const allValid = allItems.every(({ dishId }) => validateDish(dishId, selectedDishes[dishId]));
    if (!allValid) {
      setFormError("Corrigez les erreurs dans les plats.");
      return;
    }
    setFormError(null);
    setStep(2);
  };

  // Copier le récap
  const copySummary = useCallback(() => {
    const ok = copyToClipboard(decodeURIComponent(summary));
    Promise.resolve(ok).then((success) => {
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setFormError("Échec de la copie du récap.");
      }
    });
  }, [summary]);

  // Update dish after modal save
  const handleUpdateDish = useCallback((dishId, data) => {
    setSelectedDishes((prev) => ({ ...prev, [dishId]: data }));
  }, []);

  // Soumission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const phoneErrors = validatePhone();
    if (Object.keys(phoneErrors).length > 0) {
      setFormError(phoneErrors.phone);
      setError(phoneErrors.phone);
      return;
    }
    if (!formData.area) {
      setFormError("Sélectionnez un quartier.");
      setError("Sélectionnez un quartier.");
      return;
    }
    const allItems = getAllItems();
    if (allItems.length === 0) {
      setFormError("Ajoutez au moins un plat.");
      setError("Ajoutez au moins un plat.");
      return;
    }
    try {
      setLoading(true);
      setFormError(null);
      const formattedPhone = normalizePhone(formData.phone).find((v) => v.startsWith("+")) || `+${formData.phone}`;
      const guestId = `guest-${formattedPhone}`;
      const userRef = doc(db, "usersRestau", guestId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, { uid: guestId, phone: formattedPhone, isGuest: true, points: 0, createdAt: new Date() });
      }
      const orderLabel = allItems.map((item) => items.find((it) => it.id === item.dishId)?.name || "Plat inconnu").join(", ");
      const total = calculateTotal();
      let paymentUrl = null;
      let transactionId = null;
      if (formData.paymentMethod === "Mobile" && total > 0) {
        const API_URL = process.env.REACT_APP_API_URL || "https://crunchpay.seed-apps.com";
        const response = await fetch(`${API_URL}/api/payment/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: total,
            currency: "XOF",
            order_id: `temp-${Date.now()}`,
            customer_email: "client@example.com",
            description: `Commande : ${orderLabel}`,
            success_url: `${window.location.origin}/payment/success?flow=mobile`,
            failure_url: `${window.location.origin}/payment/failure?flow=mobile`,
          }),
        });
        const paymentResponse = await response.json();
        if (!response.ok || !paymentResponse.success || !paymentResponse.paymentUrl) {
          throw new Error(paymentResponse.message || "Échec de l'initialisation du paiement.");
        }
        paymentUrl = paymentResponse.paymentUrl;
        transactionId = paymentResponse.transactionId;
      }
      const orderData = {
        restaurantId: restaurantId || "",
        userId: guestId,
        contact: { phone: formattedPhone },
        address: { area: formData.area || "" },
        items: allItems.map((item) => {
          const foundItem = items.find((it) => it.id === item.dishId);
          const isSizeBased = foundItem?.priceType === "sizes" && foundItem?.sizes && item.size;
          let price;
          if (item.customPrice !== null && item.customPrice !== undefined) {
            price = Number(convertPrice(item.customPrice));
          } else {
            price = isSizeBased ? Number(convertPrice(foundItem.sizes[item.size])) : convertPrice(foundItem?.price || 0);
          }
          return {
            dishId: item.dishId || "",
            dishName: foundItem?.name || "",
            price,
            size: isSizeBased ? item.size : null,
            quantity: Number(item.quantity) || 1,
            extras: Object.entries(item.extras || {}).flatMap(([extraListId, indexes]) => {
              const extraList = extraLists.find((el) => el.id === extraListId);
              if (!extraList) return [];
              return indexes.map((index) => ({
                id: `${extraListId}-${index}`,
                name: extraList?.extraListElements[index]?.name || "",
                price: extraList?.extraListElements[index]?.price ? Number(convertPrice(extraList.extraListElements[index].price)) : 0,
              }));
            }),
          };
        }),
        deliveryFee: Number(formData.deliveryFee) || DEFAULT_DELIVERY_FEE,
        paymentMethod: formData.paymentMethod === "Mixed" ? { id: "mixed", name: "Paiement Mixte (Cash + Mobile)" } : formData.paymentMethod,
        customDiscount: Number(customDiscount) || 0,
        customTotal: customTotal !== null ? Number(customTotal) : null,
        cashAmount: formData.paymentMethod === "Mixed" ? Number(paymentSplit.cash) || 0 : 0,
        mobileAmount: formData.paymentMethod === "Mixed" ? Number(paymentSplit.mobile) || 0 : 0,
        status: "en_attente",
        isPaid: false,
        paymentRef: transactionId || null,
        timestamp: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "orders"), orderData);
      if (formData.paymentMethod === "Mobile" && transactionId) {
        const API_URL = process.env.REACT_APP_API_URL || "https://crunchpay.seed-apps.com";
        const updateResponse = await fetch(`${API_URL}/api/payment/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_id: transactionId, order_id: docRef.id }),
        });
        if (!updateResponse.ok) console.warn("Échec de la mise à jour de l'order_id:", transactionId);
        // Store pending order context for success page
        try {
          localStorage.setItem("pendingOrder", JSON.stringify({ orderId: docRef.id, transactionId }));
        } catch (e) {
          // ignore storage errors
        }
      }
      const ordersLink = `${BASE_URL}/me/${encodeURIComponent(formattedPhone)}/pay`;
      const whatsappMessage = generateWhatsAppMessage(
        formData,
        selectedDishes,
        items,
        extraLists,
        total,
        { ordersLink }
      );
      setOrderId(docRef.id);
      setSummary(whatsappMessage);
      setWhatsappUrl(`https://api.whatsapp.com/send?phone=${formattedPhone.replace("+", "")}&text=${whatsappMessage}`);
      setPublicOrderLink(ordersLink);
      setSuccess("Commande créée ! Consultez le récapitulatif.");
      setStep(3);
    } catch (err) {
      setFormError(`Échec de la création: ${err.message}`);
      setError(`Échec de la création: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Réinitialiser le formulaire
  const resetForm = useCallback(() => {
    setSelectedDishes({});
    setDishErrors({});
    setFormData({ phone: "", area: "", areaSearchQuery: "", deliveryFee: DEFAULT_DELIVERY_FEE, paymentMethod: "Cash" });
    setFilteredQuartiers([]);
    setFilteredPhones([]);
    setPhoneListPosition("below");
    setStep(1);
    setMenuFilter("");
    setSearchQuery("");
    setSummary("");
    setOrderId("");
    setWhatsappUrl("");
    setSuccess(null);
  }, []);

  const total = calculateTotal();
  const allItems = getAllItems();

  // Validation helpers for FAB
  const canProceedFromStep1 = allItems.length > 0;
  const canProceedFromStep2 = !!formData.phone && !!formData.area && !!formData.paymentMethod && allItems.length > 0 && !loading;

  const handleFabClick = () => {
    if (step === 1) {
      if (canProceedFromStep1) {
        goToNextStep();
      }
      return;
    }
    if (step === 2) {
      if (canProceedFromStep2) {
        // Trigger submit programmatically
        const fakeEvent = { preventDefault: () => {} };
        // reuse submit logic
        handleSubmit(fakeEvent);
      }
      return;
    }
    if (step === 3) {
      // On recap, restart flow
      resetForm();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Stepper sticky */}
      <div className="sticky top-0 z-40 bg-gray-50 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b">
        <div className="max-w-5xl mx-auto px-2 py-3">
          <ol className="flex items-center justify-between gap-2 text-xs sm:text-sm">
            {[
              { id: 1, label: "Plats" },
              { id: 2, label: "Infos" },
              { id: 3, label: "Récap" },
            ].map(({ id, label }, idx) => {
              const isActive = step === id;
              const isDone = step > id;
              const base = "flex items-center gap-2 flex-1";
              return (
                <li key={id} className={`${base}`}>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold " +
                        (isDone
                          ? "bg-green-600 border-green-600 text-white"
                          : isActive
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-gray-100 border-gray-300 text-gray-500")
                      }
                    >
                      {isDone ? <Check className="h-4 w-4" /> : id}
                    </span>
                    <span className={`font-medium ${isActive ? "text-gray-900" : isDone ? "text-gray-700" : "text-gray-500"}`}>{label}</span>
                  </div>
                  {idx < 2 && (
                    <div className={`mx-2 hidden sm:block h-[2px] flex-1 rounded ${step > id ? "bg-green-500" : "bg-gray-200"}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {showTitle && (
        <h2 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-6 px-2 sm:px-0">Nouvelle commande</h2>
      )}
      {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4 bg-green-50 p-2 rounded">{success}</p>}

      {step === 1 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="menuFilter" className="block text-sm font-medium text-gray-700">Menu</label>
              <select
                id="menuFilter"
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                value={menuFilter}
                onChange={(e) => setMenuFilter(e.target.value)}
              >
                <option value="">Tous les menus</option>
                {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700">Recherche</label>
              <input
                type="text"
                id="searchQuery"
                placeholder="Rechercher un plat..."
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          {/* Full-page list (no internal scroll) */}
          <ul className="space-y-3">
            {filteredItems.length === 0 ? (
              <li className="text-sm text-gray-500 text-center">Aucun plat trouvé</li>
            ) : (
              filteredItems.map((item) => {
                const dishData = selectedDishes[item.id] || { quantity: 0, size: null, extras: {} };
                const errors = dishErrors[item.id] || {};
                const isSizeBased = item.priceType === "sizes" && item.sizes;
                const dishExtraLists = extraLists.filter((el) => (item.extraLists || []).includes(el.id));
                const basePrice = isSizeBased ? convertPrice(Object.values(item.sizes)[0]) : convertPrice(item.price || 0);
                const dishTotal = calculateDishTotal(item.id, dishData);
                const imageUrl = (item.covers && item.covers.length > 0) ? item.covers[0] : item.image;

                return (
                  <li key={item.id} className="px-3 py-2 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between min-w-0 h-20">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-14 h-14 shrink-0">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name}
                              className="w-full h-full rounded-lg object-cover"
                              onError={(e) => (e.currentTarget.src = "/img/default.png")}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gray-700" />
                          )}
                          {dishData.quantity > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                              {dishData.quantity}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-black font-medium text-base truncate leading-snug">
                            {item.name} | {formatPrice(basePrice)}F
                          </p>
                          <p className="text-black text-sm truncate leading-snug">
                            {item.description || "\u00A0"}
                          </p>
                        </div>
                      </div>
                      {dishData.quantity > 0 ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, Math.max(0, (dishData.quantity || 0) - 1))}
                            className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-white font-medium">{dishData.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, (dishData.quantity || 0) + 1)}
                            className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, (dishData.quantity || 0) + 1)}
                          className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center flex-shrink-0"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {dishData.quantity > 0 && (
                      <div className="mt-2 px-3 py-3 bg-white rounded-lg border border-white space-y-3">
                        {isSizeBased && (
                          <div>
                            <label className="block text-sm font-medium text-black">Taille <span className="text-red-400">*</span></label>
                            <select
                              className={`w-full mt-1 p-2 bg-white text-black border ${errors.size ? 'border-red-500' : 'border-gray-300'} rounded-md text-sm focus:ring-2 focus:ring-blue-500`}
                              value={dishData.size || ''}
                              onChange={(e) => handleSizeChange(item.id, e.target.value)}
                            >
                              <option value="">Choisir une taille</option>
                              {Object.keys(item.sizes).map((size) => (
                                <option key={size} value={size}>{size} ({formatPrice(item.sizes[size])} FCFA)</option>
                              ))}
                            </select>
                            {errors.size && <p className="text-red-400 text-xs mt-1">{errors.size}</p>}
                          </div>
                        )}

                        {dishExtraLists.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-black">Extras</label>
                            <div className="mt-1 space-y-2">
                              {dishExtraLists.map((el) => (
                                <ExtraListItem
                                  key={el.id}
                                  extraList={el}
                                  dishData={dishData}
                                  dishId={item.id}
                                  handleExtraSelect={handleExtraSelect}
                                  formatPrice={formatPrice}
                                  errors={errors}
                                />
                              ))}
                            </div>
                            {errors.extras && Object.keys(errors.extras).length > 0 && (
                              <p className="text-red-400 text-xs mt-1">Corrigez les extras requis</p>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-sm text-black">Sous-total</p>
                          <p className="text-sm font-medium text-black">{formatPrice(dishTotal)} FCFA</p>
                        </div>
                        {errors.quantity && <p className="text-red-400 text-xs">{errors.quantity}</p>}
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
          <button
            type="button"
            className="w-full mt-4 bg-blue-600 text-white py-2 rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            onClick={goToNextStep}
            disabled={allItems.length === 0}
          >
            Suivant
          </button>
        </>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Téléphone <span className="text-red-500">*</span></label>
            <div className="relative flex items-center">
              <i className="fas fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                id="phone"
                name="phone"
                placeholder="Ex: +237123456789"
                className="w-full pl-10 p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                value={formData.phone}
                onChange={handleInputChange}
                required
                ref={phoneInputRef}
              />
            </div>
          </div>
          <div className="relative overflow-visible">
            <label htmlFor="areaSearchQuery" className="block text-sm font-medium text-gray-700">Quartier <span className="text-red-500">*</span></label>
            <div className="flex items-center">
              <input
                type="text"
                id="areaSearchQuery"
                name="areaSearchQuery"
                placeholder="Rechercher un quartier..."
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                value={formData.areaSearchQuery}
                onChange={handleInputChange}
              />
              {formData.areaSearchQuery && (
                <button type="button" className="text-gray-500 hover:text-gray-700" onClick={clearQuartierSearch}>✕</button>
              )}
            </div>
            {filteredQuartiers.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-50 bg-white w-full border border-gray-300 rounded-md max-h-48 overflow-y-auto shadow-lg">
                {filteredQuartiers.map((q, index) => (
                  <li
                    key={`${q.id}-${index}`}
                    onClick={() => handleQuartierSelect(q)}
                    className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
                  >
                    {q.name} ({formatPrice(q.fee)} FCFA)
                  </li>
                ))}
              </ul>
            )}
            {formData.area && <p className="text-sm text-gray-600 mt-2">{formData.area} ({formatPrice(formData.deliveryFee)} FCFA)</p>}
          </div>
          <div>
            <label htmlFor="deliveryFee" className="block text-sm font-medium text-gray-700">Frais de livraison</label>
            <input
              type="number"
              id="deliveryFee"
              name="deliveryFee"
              className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              value={formData.deliveryFee}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">Méthode de paiement <span className="text-red-500">*</span></label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              value={formData.paymentMethod}
              onChange={handleInputChange}
              required
            >
              <option value="Cash">Cash à la livraison</option>
              <option value="Mobile">Paiement mobile</option>
              <option value="Mixed">Paiement mixte (Cash + Mobile)</option>
            </select>
          </div>

          {/* Réduction et total personnalisé */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-3">
            <h4 className="font-medium text-sm text-gray-800">Ajustements du prix</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Réduction (FCFA)</label>
              <input
                type="number"
                value={customDiscount}
                onChange={(e) => setCustomDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
                min="0"
                step="100"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Total personnalisé (FCFA)</label>
              <input
                type="number"
                value={customTotal || ""}
                onChange={(e) => setCustomTotal(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
                min="0"
                step="100"
                placeholder="Laisser vide pour calcul automatique"
              />
              <p className="text-xs text-gray-500 mt-1">Remplace le total calculé</p>
            </div>

            {formData.paymentMethod === "Mixed" && (
              <div className="border-t pt-3">
                <h5 className="font-medium text-sm mb-2">Répartition paiement mixte</h5>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600">Cash (FCFA)</label>
                    <input
                      type="number"
                      value={paymentSplit.cash}
                      onChange={(e) => setPaymentSplit(prev => ({ ...prev, cash: Math.max(0, Number(e.target.value) || 0) }))}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      min="0"
                      step="100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">Mobile (FCFA)</label>
                    <input
                      type="number"
                      value={paymentSplit.mobile}
                      onChange={(e) => setPaymentSplit(prev => ({ ...prev, mobile: Math.max(0, Number(e.target.value) || 0) }))}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      min="0"
                      step="100"
                    />
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Total réparti: {formatPrice(paymentSplit.cash + paymentSplit.mobile)} FCFA
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-800">Résumé</span>
            <button type="button" className={`text-sm ${copied ? 'text-green-600' : 'text-blue-600 hover:text-blue-800'}`} onClick={copySummary}>
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
          {allItems.length > 0 ? (
            <>
              <ul className="space-y-2 mb-4">
                {allItems.map((itemData) => {
                  const item = items.find((it) => it.id === itemData.dishId);
                  const isSizeBased = item?.priceType === "sizes" && item?.sizes && itemData.size;
                  const extrasDetails = Object.entries(itemData.extras || {})
                    .map(([extraListId, indexes]) => {
                      const extraList = extraLists.find((el) => el.id === extraListId);
                      return indexes.map((idx) => extraList?.extraListElements[idx]?.name || "").join(",");
                    })
                    .filter(Boolean)
                    .join("; ");
                  const itemTotal = calculateDishTotal(itemData.dishId, itemData);
                  return (
                    <li key={itemData.dishId} className="p-2 bg-white border border-gray-200 rounded-md text-sm">
                      <p>{item?.name || "Plat inconnu"}{isSizeBased ? ` (${itemData.size})` : ""} x {itemData.quantity}</p>
                      {extrasDetails && <p className="text-xs text-gray-600">Extras: {extrasDetails}</p>}
                      <p className="font-medium">{formatPrice(itemTotal)} FCFA</p>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Sous-total :</span>
                  <span>{formatPrice(allItems.reduce((sum, itemData) => sum + calculateDishTotal(itemData.dishId, itemData), 0))} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>Frais de livraison :</span>
                  <span>{formatPrice(formData.deliveryFee)} FCFA</span>
                </div>
                <div className="flex justify-between font-semibold text-green-600 border-t pt-2">
                  <span>Total :</span>
                  <span>{formatPrice(total)} FCFA</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Aucun plat sélectionné</p>
          )}
          <div className="flex space-x-4">
            <button
              type="button"
              className="w-full bg-gray-300 text-gray-800 py-2 rounded-md text-sm hover:bg-gray-400"
              onClick={() => setStep(1)}
            >
              Retour
            </button>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={loading || !formData.phone || !formData.area || !formData.paymentMethod || allItems.length === 0}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z" />
                  </svg>
                  Création...
                </span>
              ) : (
                "Suivant"
              )}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="text-sm text-gray-700">Récapitulatif de la commande</div>
          <pre className="p-4 bg-gray-100 border border-gray-200 rounded-md text-sm whitespace-pre-wrap break-words">
            {decodeURIComponent(summary)}
          </pre>
          <div className="flex space-x-4">
            <button
              type="button"
              className={`w-full bg-blue-600 text-white py-2 rounded-md text-sm hover:bg-blue-700 ${copied ? 'bg-green-600' : ''}`}
              onClick={copySummary}
            >
              {copied ? 'Copié !' : 'Copier le récap'}
            </button>
            <button
              type="button"
              className="w-full bg-green-600 text-white py-2 rounded-md text-sm hover:bg-green-700"
              onClick={() => window.open(whatsappUrl, "_blank")}
            >
              Envoyer via WhatsApp
            </button>
          </div>
          <div className="flex space-x-4">
            <button
              type="button"
              className="w-full bg-gray-300 text-gray-800 py-2 rounded-md text-sm hover:bg-gray-400"
              onClick={() => setStep(2)}
            >
              Retour
            </button>
            <button
              type="button"
              className={`w-full ${copiedPaymentLink ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} text-white py-2 rounded-md text-sm`}
              onClick={async () => {
                if (!publicOrderLink) return;
                const success = await copyToClipboard(publicOrderLink);
                if (success) {
                  setCopiedPaymentLink(true);
                  setTimeout(() => setCopiedPaymentLink(false), 2000);
                } else {
                  setFormError("Impossible de copier le lien de paiement.");
                }
              }}
              disabled={!publicOrderLink}
            >
              {copiedPaymentLink ? 'Lien copié !' : 'Copier le lien de paiement'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={handleFabClick}
        className={`fixed bottom-6 right-6 z-50 inline-flex items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600
          ${step === 3 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
          ${step === 1 && !canProceedFromStep1 ? 'opacity-50 cursor-not-allowed' : ''}
          ${step === 2 && !canProceedFromStep2 ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        disabled={(step === 1 && !canProceedFromStep1) || (step === 2 && !canProceedFromStep2)}
        aria-disabled={(step === 1 && !canProceedFromStep1) || (step === 2 && !canProceedFromStep2)}
        aria-label={step === 3 ? 'Nouvelle commande' : 'Étape suivante'}
        style={{ width: 56, height: 56 }}
      >
        {step === 3 ? <Check className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
      </button>

      {/* Modal Options (sizes/extras) */}
      {showItemModal && (
        <ItemOptionsModal
          item={showItemModal.item}
          dishData={showItemModal.dishData}
          onUpdateDish={handleUpdateDish}
          onClose={() => setShowItemModal(null)}
          extraLists={extraLists}
        />
      )}
    </div>
  );
};

export default CreateOrderForm;