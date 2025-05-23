import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useCart } from "../context/cartcontext";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// Utilitaires
const convertPrice = (price) => {
  if (!price) return 0;
  return typeof price === "string" ? parseFloat(price.replace(/\./g, "")) : Number(price);
};

const formatPrice = (price) => {
  return convertPrice(price).toLocaleString();
};

// Composant ItemCard mémoïsé
const ItemCard = React.memo(({ item, onAddClick }) => {
  const sliderSettings = useMemo(
    () => ({
      dots: true,
      infinite: false,
      speed: 500,
      slidesToShow: 1,
      slidesToScroll: 1,
    }),
    []
  );

  const handleViewContent = () => {
    if (window.fbq) {
      const price = item.priceType === "sizes" && item.sizes ? convertPrice(Object.values(item.sizes)[0]) : convertPrice(item.price);
      window.fbq("track", "ViewContent", {
        content_ids: [item.id],
        content_name: item.name,
        content_type: "product",
        value: price,
        currency: "XAF",
        availability: item.available ? "in stock" : "out of stock",
      });
    }
  };

  return (
    <div className="bg-white rounded shadow-sm overflow-hidden relative transition-transform duration-300 hover:scale-105">
      <Link
        to={`/detail/${item.id}`}
        className="no-underline text-black"
        onClick={handleViewContent}
      >
        <div className="relative w-48 h-48 mx-auto bg-gray-100 rounded-t">
          {item.covers?.length > 0 ? (
            <Slider {...sliderSettings}>
              {item.covers.map((cover, index) => (
                <div key={index}>
                  <img
                    src={cover}
                    alt={`${item.name} ${index + 1}`}
                    className="w-48 h-48 object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </Slider>
          ) : (
            <img
              src="/img/default.png"
              alt={item.name}
              className="w-48 h-48 object-cover"
              loading="lazy"
            />
          )}
        </div>
        <div className="p-3">
          <h6 className="font-medium">{item.name}</h6>
          {item.priceType === "sizes" ? (
            Object.keys(item.sizes || {}).length > 0 ? (
              <p className="text-green-600 text-sm">
                {Object.entries(item.sizes).map(([size, price], index) => (
                  <span key={size}>
                    {size}: {formatPrice(price)} Fcfa
                    {index < Object.keys(item.sizes).length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-red-600 text-sm">Aucune taille disponible</p>
            )
          ) : (
            <h6 className="text-green-600">{formatPrice(item.price)} Fcfa</h6>
          )}
        </div>
      </Link>
      <button
        onClick={(e) => onAddClick(item, e)}
        className="bg-green-600 text-white px-2 py-1 rounded-full text-sm absolute bottom-2 right-2 hover:bg-green-700"
        aria-label={`Ajouter ${item.name} au panier`}
        disabled={!item.available}
      >
        +
      </button>
    </div>
  );
});

const CategoryListing = () => {
  const { id: categoryId } = useParams();
  const [items, setItems] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [validationError, setValidationError] = useState(null);
  const { addToCart, cartItems } = useCart();

  // Initialiser les tailles par défaut pour les articles
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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const itemsQuery = query(collection(db, "items"), where("categoryId", "==", categoryId));
      const [itemsSnapshot, extraListsSnapshot] = await Promise.all([
        getDocs(itemsQuery),
        getDocs(collection(db, "extraLists")),
      ]);

      const itemsData = itemsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          available: doc.data().available !== undefined ? doc.data().available : true,
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

      setItems(itemsData);
      setExtraLists(extraListsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      if (itemsData.length > 0 && itemsData[0].menuId) {
        const menuDocRef = doc(db, "menus", itemsData[0].menuId);
        const menuSnapshot = await getDoc(menuDocRef);
        if (menuSnapshot.exists()) {
          setMenu({ id: menuSnapshot.id, ...menuSnapshot.data() });
        } else {
          console.warn(`Menu avec ID ${itemsData[0].menuId} non trouvé dans Firestore.`);
        }
      }
    } catch (err) {
      setError("Erreur lors de la récupération des données");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Générer les microdonnées Schema.org
  const generateSchemaOrgJSONLD = useCallback(() => {
    const schemaData = items.map((item) => ({
      "@context": "https://schema.org",
      "@type": "Product",
      "productID": item.id,
      "name": item.name || "Produit sans nom",
      "description": item.description || "Description non disponible",
      "image": item.covers?.[0] || "https://www.mangedabord.com/img/default.png",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "XAF",
        "price": item.priceType === "sizes" && item.sizes
          ? convertPrice(Object.values(item.sizes)[0] || "0").toString()
          : convertPrice(item.price || "0").toString(),
        "availability": item.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "url": `https://www.mangedabord.com/detail/${item.id}`,
      },
    }));
    return schemaData;
  }, [items]);

  useEffect(() => {
    if (categoryId) fetchData();
  }, [categoryId]);

  // Injecter les microdonnées dans le DOM
  useEffect(() => {
    if (items.length > 0) {
      const schemaData = generateSchemaOrgJSONLD();
      const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
      existingScripts.forEach((script) => script.remove());

      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(schemaData);
      document.head.appendChild(script);

      return () => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        scripts.forEach((s) => s.remove());
      };
    }
  }, [items, generateSchemaOrgJSONLD]);

  const calculateTotalPrice = useCallback(() => {
    let total = selectedItem
      ? selectedItem.priceType === "sizes" && selectedSizes[selectedItem.id]
        ? convertPrice(selectedItem.sizes[selectedSizes[selectedItem.id]])
        : convertPrice(selectedItem.price)
      : 0;
    if (isNaN(total)) total = 0;

    Object.entries(selectedExtras).forEach(([assortmentId, indexes]) => {
      const extraList = extraLists.find((el) => el.id === assortmentId);
      if (extraList && selectedItem?.assortments?.includes(assortmentId)) {
        indexes.forEach((index) => {
          const extraPrice = convertPrice(extraList.extraListElements?.[index]?.price || 0);
          total += isNaN(extraPrice) ? 0 : extraPrice;
        });
      }
    });
    return total;
  }, [selectedItem, selectedExtras, selectedSizes, extraLists]);

  const validateExtras = useCallback(() => {
    if (!selectedItem) return { isValid: false, error: null };

    // Valider la sélection de taille pour priceType: 'sizes'
    if (selectedItem.priceType === "sizes" && !selectedSizes[selectedItem.id]) {
      return { isValid: false, error: "Veuillez sélectionner une taille." };
    }

    // Valider les extras
    for (const assortmentId of selectedItem.assortments || []) {
      const extraList = extraLists.find((el) => el.id === assortmentId);
      if (!extraList) continue;

      const requiredElements = extraList.extraListElements?.filter((el) => el.required) || [];
      if (requiredElements.length === 0) continue;

      const selected = Array.isArray(selectedExtras[assortmentId]) ? selectedExtras[assortmentId] : [];
      if (selected.length === 0) {
        return {
          isValid: false,
          error: `Veuillez sélectionner tous les extras obligatoires pour « ${extraList.name} ».`,
        };
      }
    }
    return { isValid: true, error: null };
  }, [selectedItem, selectedExtras, selectedSizes, extraLists]);

  const trackAddToCart = (item, totalPrice) => {
    if (window.fbq) {
      window.fbq("track", "AddToCart", {
        content_ids: [item.id],
        content_name: item.name,
        content_type: "product",
        value: totalPrice,
        currency: "XAF",
        availability: item.available ? "in stock" : "out of stock",
        num_items: 1,
      });
    }
  };

  const handleAddClick = useCallback(
    (item, e) => {
      e.preventDefault();
      setSelectedItem(item);
      setSelectedExtras({}); // Réinitialiser les extras
      setValidationError(null);
    },
    []
  );

  const handleAddToCart = useCallback(() => {
    if (!selectedItem) return;

    const validation = validateExtras();
    if (validation.isValid) {
      const totalPrice = calculateTotalPrice();
      const cartItem = {
        ...selectedItem,
        restaurantId: selectedItem.restaurantId || "default_restaurant_id",
        selectedExtras,
        selectedSize: selectedSizes[selectedItem.id],
        price: totalPrice,
        quantity: 1,
      };
      addToCart(cartItem);
      setSuccessMessage(
        `${selectedItem.name}${selectedSizes[selectedItem.id] ? ` (${selectedSizes[selectedItem.id]})` : ""} ajouté au panier !`
      );
      setTimeout(() => setSuccessMessage(""), 3000);
      trackAddToCart(selectedItem, totalPrice);
      setSelectedItem(null);
      setSelectedExtras({});
      setValidationError(null);
    } else {
      setValidationError(validation.error);
    }
  }, [addToCart, selectedItem, selectedExtras, selectedSizes, calculateTotalPrice]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          {Array(3)
            .fill()
            .map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-lg shadow-md animate-pulse">
                <div className="w-48 h-48 bg-gray-300 rounded-t-lg mx-auto"></div>
                <div className="p-4 space-y-2">
                  <div className="h-5 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-full"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flexed flex-col items-center justify-center">
        <p className="text-red-600 text-center">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {successMessage && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">
          {successMessage}
        </div>
      )}

      <header className="bg-white border-b p-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/accueil" className="text-green-600 font-bold flex items-center">
              <i className="fas fa-arrow-left mr-2"></i> Retour
            </Link>
            <h2 className="ml-4 text-xl font-bold">Plats de la catégorie</h2>
          </div>
          {menu && menu.id && menu.name && (
            <Link
              to={`/menu/${menu.id}`}
              className="text-green-600 font-medium text-sm hover:underline"
            >
              {menu.name}
            </Link>
          )}
        </div>
      </header>

      <div className="px-3 py-2 bg-white">
        {items.length === 0 ? (
          <p className="p-4 text-center text-gray-600">Aucun plat trouvé pour cette catégorie.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onAddClick={handleAddClick} />
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold">Options pour {selectedItem.name}</h3>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setSelectedExtras({});
                  setValidationError(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {validationError && (
                <div
                  className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
                  role="alert"
                >
                  {validationError}
                  <button
                    className="absolute top-0 right-0 px-2 py-1 text-red-700"
                    onClick={() => setValidationError(null)}
                  >
                    ×
                  </button>
                </div>
              )}
              {/* Size Selection */}
              {selectedItem.priceType === "sizes" && (
                Object.keys(selectedItem.sizes || {}).length > 0 ? (
                  <div className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">
                      Taille <span className="text-red-500 ml-1">*</span>
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(selectedItem.sizes).map(([size, price], index) => (
                        <label
                          key={size}
                          className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            selectedSizes[selectedItem.id] === size
                              ? "bg-green-50 border-2 border-green-200"
                              : "border border-gray-200 hover:border-green-200"
                          } ${
                            validationError?.includes("taille") && !selectedSizes[selectedItem.id]
                              ? "border-red-400 bg-red-50"
                              : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="size"
                            value={size}
                            checked={selectedSizes[selectedItem.id] === size}
                            onChange={(e) => {
                              setValidationError(null);
                              setSelectedSizes((prev) => ({
                                ...prev,
                                [selectedItem.id]: e.target.value,
                              }));
                            }}
                            className="form-radio h-5 w-5 text-green-600 focus:ring-green-500"
                            aria-required="true"
                            aria-invalid={validationError?.includes("taille") && !selectedSizes[selectedItem.id]}
                          />
                          <div className="ml-3 flex-1">
                            <span className="text-gray-700">{size}</span>
                            <span className="text-sm text-gray-500 ml-2">
                              {convertPrice(price).toLocaleString()} Fcfa
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-red-600 text-sm">Aucune taille disponible</p>
                )
              )}
              {/* Extras Selection */}
              {selectedItem.assortments?.length === 0 ? (
                selectedItem.priceType !== "sizes" && (
                  <p className="text-gray-500 text-center">Aucun complément associé à ce plat.</p>
                )
              ) : (
                selectedItem.assortments.map((assortmentId) => {
                  const extraList = extraLists.find((el) => el.id === assortmentId);
                  if (!extraList) return null;

                  const hasError = validationError?.includes(extraList.name);

                  return (
                    <div key={extraList.id} className="mb-6">
                      <h4
                        className={`font-medium mb-3 text-gray-700 ${
                          hasError ? "text-red-600" : ""
                        }`}
                      >
                        {extraList.name}
                        {extraList.extraListElements?.some((el) => el.required) && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {extraList.extraListElements?.map((el, index) => (
                          <label
                            key={index}
                            className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                              Array.isArray(selectedExtras[assortmentId]) && selectedExtras[assortmentId].includes(index)
                                ? "bg-green-50 border-2 border-green-200"
                                : "border border-gray-200 hover:border-green-200"
                            } ${
                              el.required &&
                              hasError &&
                              !(Array.isArray(selectedExtras[assortmentId]) && selectedExtras[assortmentId].includes(index))
                                ? "border-red-400 bg-red-50"
                                : ""
                            }`}
                          >
                            <input
                              type={el.multiple ? "checkbox" : "radio"}
                              checked={Array.isArray(selectedExtras[assortmentId]) && selectedExtras[assortmentId].includes(index)}
                              onChange={(e) => {
                                setValidationError(null);
                                const currentSelection = Array.isArray(selectedExtras[assortmentId])
                                  ? [...selectedExtras[assortmentId]]
                                  : [];
                                if (el.multiple) {
                                  if (e.target.checked) {
                                    currentSelection.push(index);
                                  } else {
                                    const idx = currentSelection.indexOf(index);
                                    if (idx !== -1) {
                                      currentSelection.splice(idx, 1);
                                    }
                                  }
                                } else {
                                  currentSelection.length = 0;
                                  if (e.target.checked) {
                                    currentSelection.push(index);
                                  }
                                }
                                setSelectedExtras({
                                  ...selectedExtras,
                                  [assortmentId]: currentSelection,
                                });
                              }}
                              className="form-checkbox h-5 w-5 text-green-600 focus:ring-green-500"
                              aria-required={el.required}
                              aria-invalid={
                                el.required &&
                                hasError &&
                                !(Array.isArray(selectedExtras[assortmentId]) && selectedExtras[assortmentId].includes(index))
                              }
                            />
                            <div className="ml-3 flex-1">
                              <span className="text-gray-700">{el.name}</span>
                              {el.price && (
                                <span className="text-sm text-gray-500 ml-2">
                                  + {convertPrice(el.price).toLocaleString()} FCFA
                                </span>
                              )}
                            </div>
                            {el.required && (
                              <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                                Obligatoire
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setSelectedExtras({});
                    setValidationError(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex-1"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={!validateExtras().isValid || !selectedItem.available}
                  className={`px-4 py-2 rounded-lg flex-1 transition-all duration-200 ${
                    validateExtras().isValid && selectedItem.available
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

      <footer className="fixed bottom-0 w-full bg-white border-t text-center z-40 shadow-lg">
        <div className="grid grid-cols-4">
          <Link
            to="/accueil"
            className="text-gray-700 p-2 hover:text-green-600 transition-colors"
          >
            <i className="fas fa-home text-lg"></i>
            <span className="block text-xs mt-1">Accueil</span>
          </Link>
          <Link
            to="/cart"
            className="relative text-gray-700 p-2 hover:text-green-600 transition-colors"
          >
            <i className="fas fa-shopping-cart text-lg"></i>
            {cartItems.length > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-green-600 rounded-full">
                {cartItems.length}
              </span>
            )}
            <span className="block text-xs mt-1">Panier</span>
          </Link>
          <Link
            to="/complete_order"
            className="text-gray-700 p-2 hover:text-green-600 transition-colors"
          >
            <i className="fas fa-shopping-bag text-lg"></i>
            <span className="block text-xs mt-1">Commandes</span>
          </Link>
          <Link
            to="/profile"
            className="text-gray-700 p-2 hover:text-green-600 transition-colors"
          >
            <i className="fas fa-user text-lg"></i>
            <span className="block text-xs mt-1">Compte</span>
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default CategoryListing;