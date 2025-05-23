import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { useCart } from "../context/cartcontext";
import { Helmet } from "react-helmet";
import logo from "../image/logo.png";

// Fonction utilitaire pour normaliser les prix
const normalizePrice = (price) =>
  typeof price === "string"
    ? parseFloat(price.replace(/\./g, ""))
    : Number(price);

// Fonction pour tronquer la description à la première ligne
const truncateDescription = (description, maxLength = 60) => {
  if (!description) return "";
  const firstLine = description.split("\n")[0];
  if (firstLine.length <= maxLength) return firstLine;
  return firstLine.substring(0, maxLength) + "...";
};

// Fonction pour tronquer le nom
const truncateName = (name, maxLength = 30) => {
  if (!name) return "";
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength) + "...";
};

// Composant pour un item, memoïsé pour éviter des re-rendus inutiles
const MenuItem = React.memo(({ item, handleAddClick, onItemClick, isDescriptionVisible }) => {
  const isDescriptionTruncated = item.description && item.description.length > 60;
  const isNameTruncated = item.name && item.name.length > 30;

  // Formatage du prix pour priceType: "sizes"
  const formatPrice = () => {
    if (item.price) {
      return `${normalizePrice(item.price).toLocaleString()} Fcfa`;
    }
    if (item.priceType === "sizes" && item.sizes && Object.keys(item.sizes).length > 0) {
      return Object.entries(item.sizes)
        .map(([sz, pr]) => `${sz}: ${normalizePrice(pr).toLocaleString()} Fcfa`)
        .join(" • ");
    }
    return "Prix indisponible";
  };

  // Désactiver le bouton si le prix est invalide
  const isPriceInvalid =
    item.priceType === "sizes" && (!item.sizes || Object.keys(item.sizes).length === 0);

  return (
    <div
      className="flex items-start py-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
      onClick={() => onItemClick(item.id)}
    >
      {/* Image */}
      <div className="flex-shrink-0 mr-3">
        {item.covers?.[0] ? (
          <img
            src={item.covers[0]}
            alt={item.name}
            className="w-16 h-16 rounded-lg object-cover"
            onError={(e) => (e.target.src = "https://via.placeholder.com/150?text=Aucune+image")}
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
            <i className="fas fa-image text-gray-500 text-xl" />
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-start">
          {/* Nom et description */}
          <div className="flex-1 pr-2">
            <h3
              className={`text-base font-medium text-gray-900 ${
                isDescriptionVisible ? "whitespace-normal" : "truncate"
              }`}
            >
              {isDescriptionVisible ? item.name : truncateName(item.name)}
              {isNameTruncated && (
                <span className="text-green-600 text-xs ml-1 cursor-pointer">
                  {isDescriptionVisible ? "Voir moins" : "Voir plus"}
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {isDescriptionVisible
                ? item.description || "Aucune description disponible"
                : truncateDescription(item.description)}
              {isDescriptionTruncated && !isNameTruncated && (
                <span className="text-green-600 text-xs ml-1 cursor-pointer">
                  {isDescriptionVisible ? "Voir moins" : "Voir plus"}
                </span>
              )}
            </p>
          </div>

          {/* Prix */}
          <div className="max-w-[150px] text-right">
            <p
              className={`text-xs font-semibold ${
                isPriceInvalid ? "text-red-500" : "text-green-600"
              } truncate`}
              title={formatPrice()} // Afficher le prix complet au survol
            >
              {formatPrice()}
            </p>
          </div>
        </div>

        {/* Bouton d’ajout */}
        <div className="flex justify-end mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddClick(item, e);
            }}
            disabled={isPriceInvalid}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150 ${
              isPriceInvalid
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            <i className="fas fa-plus text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
});

const MenuDisplayPage = () => {
  const { id: menuId } = useParams();
  const navigate = useNavigate();
  const { addToCart, cartItems } = useCart();

  // États
  const [menu, setMenu] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coverError, setCoverError] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [visibleDescription, setVisibleDescription] = useState(null);

  // Initialisation des tailles par défaut
  useEffect(() => {
    if (items.length > 0) {
      const initialSizes = {};
      items.forEach((item) => {
        if (item.priceType === "sizes" && item.sizes && Object.keys(item.sizes).length > 0) {
          initialSizes[item.id] = Object.keys(item.sizes)[0];
        }
      });
      setSelectedSizes((prev) => ({ ...prev, ...initialSizes }));
    }
  }, [items]);

  // Récupération des données
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (!menuId) throw new Error("ID de menu manquant");

      const mSnap = await getDoc(doc(db, "menus", menuId));
      if (!mSnap.exists()) throw new Error("Menu introuvable");
      setMenu({ id: mSnap.id, ...mSnap.data() });

      const iSnap = await getDocs(
        query(collection(db, "items"), where("menuId", "==", menuId))
      );
      const fetchedItems = iSnap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          assortments: doc.data().assortments || [],
        }))
        .filter((item) => {
          if (item.priceType === "sizes") {
            const isValid = item.sizes && Object.keys(item.sizes).length > 0;
            if (!isValid) {
              console.warn(`Article ${item.id} ignoré : sizes invalide`, item.sizes);
            }
            return isValid;
          }
          return true;
        });

      setItems(fetchedItems);

      const cSnap = await getDocs(collection(db, "categories"));
      setCategories(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const eSnap = await getDocs(collection(db, "extraLists"));
      setExtraLists(eSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [menuId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Regroupement par catégorie
  const itemsByCat = useMemo(() => {
    const grouped = items.reduce((acc, it) => {
      const cat =
        categories.find((c) => c.id === it.categoryId)?.name || "Autres";
      (acc[cat] = acc[cat] || []).push(it);
      return acc;
    }, {});
    ["Entrées", "Plats principaux", "Desserts", "Boissons"].forEach((k) => {
      if (grouped[k]) {
        grouped["__order__" + k] = grouped[k];
        delete grouped[k];
      }
    });
    const result = {};
    Object.keys(grouped)
      .sort((a, b) => (a.startsWith("__order__") ? -1 : 1))
      .forEach((k) => {
        const name = k.replace("__order__", "");
        result[name] = grouped[k];
      });
    return result;
  }, [items, categories]);

  const handleAddClick = (item, e) => {
    e.stopPropagation();
    setSelectedItem({
      ...item,
      assortments: item.assortments || [],
      selectedSize: selectedSizes[item.id] || (item.sizes && Object.keys(item.sizes)[0]) || null,
    });
    setSelectedExtras({});
  };

  const handleItemClick = (itemId) => {
    setVisibleDescription((prev) => (prev === itemId ? null : itemId));
  };

  const validateExtras = () => {
    if (!selectedItem) return false;
    if (
      selectedItem.priceType === "sizes" &&
      selectedItem.sizes &&
      Object.keys(selectedItem.sizes).length > 0 &&
      !selectedItem.selectedSize
    ) {
      return false;
    }
    const assortments = Array.isArray(selectedItem.assortments) ? selectedItem.assortments : [];
    if (assortments.length === 0) return true;
    return assortments.every((assortmentId) => {
      const extraList = extraLists.find((el) => el.id === assortmentId);
      const requiredElements = extraList?.extraListElements?.filter((el) => el.required) || [];
      if (requiredElements.length === 0) return true;
      const selected = selectedExtras[assortmentId] || [];
      return selected.length > 0;
    });
  };

  const calculateTotalPrice = () => {
    if (!selectedItem) return 0;
    let total =
      selectedItem.priceType === "sizes" && selectedItem.sizes && Object.keys(selectedItem.sizes).length > 0
        ? normalizePrice(selectedItem.sizes[selectedItem.selectedSize || selectedSizes[selectedItem.id]])
        : normalizePrice(selectedItem.price);
    if (isNaN(total)) total = 0;

    Object.entries(selectedExtras).forEach(([assortmentId, indexes]) => {
      const extraList = extraLists.find((el) => el.id === assortmentId);
      if (extraList) {
        indexes.forEach((index) => {
          const extraPrice = normalizePrice(extraList.extraListElements?.[index]?.price);
          total += isNaN(extraPrice) ? 0 : extraPrice;
        });
      }
    });
    return total;
  };

  const handleAddToCart = () => {
    if (validateExtras()) {
      const price =
        selectedItem.priceType === "sizes" && selectedItem.sizes && Object.keys(selectedItem.sizes).length > 0
          ? selectedItem.sizes[selectedItem.selectedSize]
          : selectedItem.price;
      addToCart({
        selectedItem,
        restaurantId: selectedItem.restaurantId || "default_restaurant_id",
        selectedExtras,
        selectedSize: selectedItem.selectedSize,
        price,
      });
      setSuccessMessage(`${selectedItem.name} ajouté au panier !`);
      setTimeout(() => setSuccessMessage(""), 2000);
      setSelectedItem(null);
    } else {
      setSuccessMessage("Veuillez sélectionner une taille ou les extras requis.");
      setTimeout(() => setSuccessMessage(""), 2000);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <i className="fas fa-spinner fa-spin text-3xl text-green-500" />
      </div>
    );
  if (error)
    return (
      <div className="p-4 text-center text-red-500 bg-white">
        {error}{" "}
        <button onClick={() => navigate("/accueil")} className="underline text-gray-900">
          Retour
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-white pb-16">
      <Helmet>
        <title>{menu.name} - Catalogue</title>
      </Helmet>

      {successMessage && (
        <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg z-50 animate-bounce text-sm">
          {successMessage}
        </div>
      )}

      {/* Header */}
      <header className="bg-white p-3 flex items-center shadow-sm fixed top-0 w-full z-50">
        <Link to="/accueil" className="text-gray-900 mr-3">
          <i className="fas fa-arrow-left text-lg" />
        </Link>
        <h1 className="flex-1 font-semibold text-gray-900 text-lg">Catalogue</h1>
        <Link to="/cart" className="relative text-gray-900">
          <i className="fas fa-shopping-cart text-lg" />
          {cartItems.length > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {cartItems.length}
            </span>
          )}
        </Link>
      </header>
      <div className="h-14" />

      {/* Promotional Banner */}
      {menu.covers?.[0] && !coverError ? (
        <img
          src={logo}
          alt={menu.name}
          onError={() => setCoverError(true)}
          className="w-full h-48 object-cover"
        />
      ) : (
        <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
          <i className="fas fa-image text-gray-500 text-3xl" />
        </div>
      )}

      {/* Liste des items */}
      <main className="px-2 py-3 space-y-3">
        {Object.keys(itemsByCat).map((cat) => (
          <div key={cat}>
            <h2 className="text-gray-900 font-semibold text-lg mb-2">{cat}</h2>
            {itemsByCat[cat].map((item) => (
              <MenuItem
                key={item.id}
                item={item}
                handleAddClick={handleAddClick}
                onItemClick={handleItemClick}
                isDescriptionVisible={visibleDescription === item.id}
              />
            ))}
          </div>
        ))}
      </main>

      {/* Modale */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Options pour {selectedItem.name}</h3>
              <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-gray-700 text-xl">×</button>
            </div>
            <div className="p-4">
              {selectedItem.priceType === "sizes" && Object.keys(selectedItem.sizes || {}).length > 0 ? (
                <div className="mb-4">
                  <h4 className="font-medium mb-2 text-gray-700">
                    Choisir une taille <span className="text-red-500">*</span>
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(selectedItem.sizes).map(([size, price]) => (
                      <label
                        key={size}
                        className={`flex items-center p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                          (selectedItem.selectedSize || selectedSizes[selectedItem.id] || Object.keys(selectedItem.sizes)[0]) === size
                            ? "bg-green-50 border-2 border-green-200"
                            : "border border-gray-200 hover:border-green-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="size"
                          value={size}
                          checked={(selectedItem.selectedSize || selectedSizes[selectedItem.id] || Object.keys(selectedItem.sizes)[0]) === size}
                          onChange={(e) => {
                            const newSize = e.target.value;
                            setSelectedItem({ ...selectedItem, selectedSize: newSize });
                            setSelectedSizes((prev) => ({
                              ...prev,
                              [selectedItem.id]: newSize,
                            }));
                          }}
                          className="form-radio h-4 w-4 text-green-600 focus:ring-green-500"
                        />
                        <div className="ml-2 flex-1">
                          <span className="text-gray-700">{size}</span>
                          <span className="text-xs text-gray-500 ml-2">{normalizePrice(price).toLocaleString()} Fcfa</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : selectedItem.priceType === "sizes" ? (
                <p className="text-red-600 text-sm mb-4">Aucune taille disponible</p>
              ) : null}

              {selectedItem.assortments?.length > 0 ? (
                selectedItem.assortments.map((assortmentId) => {
                  const extraList = extraLists.find((el) => el.id === assortmentId);
                  if (!extraList) {
                    return <p key={assortmentId} className="text-red-600 text-sm mb-4">Extra indisponible</p>;
                  }
                  return (
                    <div key={extraList.id} className="mb-4">
                      <h4 className="font-medium mb-2 text-gray-700">
                        {extraList.name}
                        {extraList.extraListElements?.some((el) => el.required) && <span className="text-red-500 ml-1">*</span>}
                      </h4>
                      {extraList.extraListElements?.length > 0 ? (
                        <div className="space-y-2">
                          {extraList.extraListElements.map((el, index) => (
                            <label
                              key={index}
                              className={`flex items-center p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                selectedExtras[assortmentId]?.includes(index)
                                  ? "bg-green-50 border-2 border-green-200"
                                  : "border border-gray-200 hover:border-green-200"
                              }`}
                            >
                              <input
                                type={el.multiple ? "checkbox" : "radio"}
                                checked={selectedExtras[assortmentId]?.includes(index)}
                                onChange={(e) => {
                                  const newSelection = [...(selectedExtras[assortmentId] || [])];
                                  if (el.multiple) {
                                    e.target.checked
                                      ? newSelection.push(index)
                                      : newSelection.splice(newSelection.indexOf(index), 1);
                                  } else {
                                    newSelection.length = 0;
                                    newSelection.push(index);
                                  }
                                  setSelectedExtras({ ...selectedExtras, [assortmentId]: newSelection });
                                }}
                                className="form-checkbox h-4 w-4 text-green-600 focus:ring-green-500"
                              />
                              <div className="ml-2 flex-1">
                                <span className="text-gray-700">{el.name}</span>
                                {el.price && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    + {normalizePrice(el.price).toLocaleString()} FCFA
                                  </span>
                                )}
                              </div>
                              {el.required && (
                                <span className="text-xs text-red-500 bg-red-50 px-1 py-0.5 rounded">Obligatoire</span>
                              )}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-red-600 text-sm">Aucun élément extra disponible</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-sm mb-4">Aucun extra disponible</p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex-1 transition-colors duration-150 text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={!validateExtras()}
                  className={`px-3 py-2 rounded-lg flex-1 transition-all duration-150 text-sm ${
                    validateExtras()
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Confirmer ({calculateTotalPrice().toLocaleString()} FCFA)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuDisplayPage;