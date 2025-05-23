import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet";
import { db } from "../firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { Link, useParams, useNavigate } from "react-router-dom";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useCart } from "../context/cartcontext";
import { FaShoppingCart } from "react-icons/fa";

const ProductDetails = () => {
  const { id } = useParams(); // Utiliser l'ID au lieu du slug
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [extraLists, setExtraLists] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [validationError, setValidationError] = useState(null);

  console.log("ID extrait de l'URL :", id);

  // Initialiser la taille par défaut pour les produits avec tailles
  useEffect(() => {
    if (
      product &&
      product.priceType === "sizes" &&
      product.sizes &&
      Object.keys(product.sizes).length > 0 &&
      Object.values(product.sizes).some((price) => price && convertPrice(price) > 0)
    ) {
      const validSize = Object.keys(product.sizes).find(
        (size) => product.sizes[size] && convertPrice(product.sizes[size]) > 0
      );
      if (validSize) {
        setSelectedSizes({ [product.id]: validSize });
      }
    }
  }, [product]);

  // Récupérer les avis
  const fetchReviews = async (productId) => {
    try {
      const reviewsRef = collection(db, "items", productId, "reviews");
      const reviewsSnapshot = await getDocs(reviewsRef);
      const reviewsData = reviewsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date || "Date inconnue",
      }));
      setReviews(reviewsData);
    } catch (error) {
      console.error("Erreur lors du chargement des avis :", error);
    }
  };

  // Récupérer les détails du produit par ID
  const fetchProductDetails = async () => {
    setLoading(true);
    try {
      const productRef = doc(db, "items", id);
      const productDoc = await getDoc(productRef);
      console.log("Document Firestore :", productDoc.exists() ? productDoc.data() : "Non trouvé");
      if (!productDoc.exists()) {
        setError("Produit non trouvé. Il est possible que ce produit n'existe pas.");
        setLoading(false);
        navigate("/accueil");
        return;
      }
      const productData = productDoc.data();
      if (!productData.name) {
        setError("Nom du produit manquant.");
        setLoading(false);
        return;
      }
      const finalProductData = {
        id: productDoc.id,
        name: productData.name || "Produit sans nom",
        price: productData.price || "0",
        priceType: productData.priceType || "single",
        sizes: productData.priceType === "single" ? {} : productData.sizes || {},
        covers: productData.covers || [],
        description: productData.description || "Aucune description disponible.",
        available: productData.available !== undefined ? productData.available : true,
        assortments: productData.assortments || [],
        discount: productData.discount || 0,
        saleMode: productData.saleMode || "unité",
      };
      if (
        finalProductData.priceType === "sizes" &&
        (!finalProductData.sizes || Object.keys(finalProductData.sizes).length === 0)
      ) {
        setError("Produit invalide : aucune taille disponible.");
        setLoading(false);
        return;
      }
      setProduct(finalProductData);
      console.log("Produit chargé :", finalProductData);

      const extraListsSnapshot = await getDocs(collection(db, "extraLists"));
      const extraListsData = extraListsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setExtraLists(extraListsData);

      await fetchReviews(productDoc.id);
    } catch (err) {
      setError("Erreur lors de la récupération du produit.");
      console.error("Erreur Firestore :", err);
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les produits recommandés
  const fetchRecommendedProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "items"));
      const recommendedData = querySnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Nom inconnu",
            price: data.price || "0",
            priceType: data.priceType || "single",
            sizes: data.priceType === "single" ? {} : data.sizes || {},
            covers: data.covers || [],
            discount: data.discount || 0,
            available: data.available !== undefined ? data.available : true,
          };
        })
        .filter(
          (item) =>
            item.id !== id &&
            item.name !== "Nom inconnu" &&
            (item.priceType !== "sizes" ||
              (item.sizes &&
                Object.keys(item.sizes).length > 0 &&
                Object.values(item.sizes).some((price) => price && convertPrice(price) > 0)))
        );
      setRecommendedProducts(recommendedData);
    } catch (err) {
      setError("Erreur lors de la récupération des produits recommandés.");
      console.error(err);
    }
  };

  // Fonctions utilitaires
  const convertPrice = (price) => {
    if (typeof price === "string") {
      const cleanedPrice = price.replace(/[^0-9,.]/g, "").replace(",", ".");
      return parseFloat(cleanedPrice) || 0;
    }
    return Number(price) || 0;
  };

  const formatPrice = (price) => {
    return convertPrice(price).toLocaleString("fr-FR", { currency: "XAF" }) + " FCFA";
  };

  const validateExtras = useCallback(() => {
    if (!selectedItem) return { isValid: false, error: null };

    if (
      selectedItem.priceType === "sizes" &&
      Object.keys(selectedItem.sizes || {}).length > 0 &&
      !selectedSizes[selectedItem.id]
    ) {
      return { isValid: false, error: "Veuillez sélectionner une taille." };
    }

    for (const assortmentId of selectedItem.assortments || []) {
      const extraList = extraLists.find((el) => el.id === assortmentId);
      if (!extraList) continue;

      const requiredElements = extraList.extraListElements?.filter((el) => el.required) || [];
      if (requiredElements.length === 0) continue;

      const selected = selectedExtras[assortmentId] || [];
      if (selected.length === 0) {
        return {
          isValid: false,
          error: `Veuillez sélectionner tous les extras obligatoires pour « ${extraList.name} ».`,
        };
      }
    }
    return { isValid: true, error: null };
  }, [selectedItem, selectedSizes, selectedExtras, extraLists]);

  const calculateTotalPrice = useCallback(() => {
    const itemToUse = selectedItem || product;
    let total = itemToUse
      ? itemToUse.priceType === "sizes" && selectedSizes[itemToUse.id]
        ? convertPrice(itemToUse.sizes[selectedSizes[itemToUse.id]])
        : convertPrice(itemToUse.price)
      : 0;
    if (isNaN(total)) total = 0;

    Object.entries(selectedExtras).forEach(([assortmentId, indexes]) => {
      const extraList = extraLists.find((el) => el.id === assortmentId);
      if (extraList && itemToUse.assortments?.includes(assortmentId)) {
        indexes.forEach((index) => {
          const extra = extraList.extraListElements[index];
          if (extra && extra.price) {
            total += convertPrice(extra.price);
          }
        });
      }
    });
    return total * quantity;
  }, [selectedItem, product, selectedSizes, selectedExtras, extraLists, quantity]);

  const handleQuantityChange = (delta) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const handleCartAction = (navigateToCheckout) => {
    if (!product?.available) return;
    setSelectedItem(product);
    setSelectedExtras({});
    setValidationError(null);
    setSelectedSizes(
      product.priceType === "sizes" &&
      product.sizes &&
      Object.values(product.sizes).some((price) => price && convertPrice(price) > 0)
        ? {
            [product.id]: Object.keys(product.sizes).find(
              (size) => product.sizes[size] && convertPrice(product.sizes[size]) > 0
            ),
          }
        : {}
    );
    console.log(`Action panier déclenchée pour ${product.name} (navigateToCheckout: ${navigateToCheckout})`);
  };

  const addProductToCart = (navigateToCheckout = false) => {
    const validation = validateExtras();
    if (!validation.isValid) {
      setValidationError(validation.error);
      console.log(`Validation échouée : ${validation.error}`);
      return;
    }

    const totalPrice = calculateTotalPrice();
    const cartItem = {
      ...selectedItem,
      restaurantId: selectedItem.restaurantId || "default_restaurant_id",
      quantity,
      selectedExtras,
      selectedSize: selectedItem.priceType === "sizes" ? selectedSizes[selectedItem.id] : null,
      price: totalPrice / quantity,
    };

    addToCart(cartItem);
    setSuccessMessage(
      `${selectedItem.name}${selectedItem.priceType === "sizes" && selectedSizes[selectedItem.id] ? ` (${selectedSizes[selectedItem.id]})` : ""} ajouté au panier !`
    );
    setTimeout(() => setSuccessMessage(""), 3000);
    setSelectedItem(null);
    setSelectedExtras({});
    setSelectedSizes({});
    setValidationError(null);
    setQuantity(1);

    trackAddToCart(totalPrice);
    console.log(`Ajout au panier : ${selectedItem.name} (${selectedItem.id}), navigation vers ${navigateToCheckout ? "/accueil" : "/cart"}`);
    navigate(navigateToCheckout ? "/accueil" : "/cart");
    if (navigateToCheckout) trackInitiateCheckout();
  };

  // Fonctions de suivi
  const trackViewContent = (item) => {
    if (window.fbq && item) {
      const price = item.priceType === "sizes" && item.sizes
        ? convertPrice(Object.values(item.sizes)[0])
        : convertPrice(item.price);
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

  const trackAddToCart = (totalPrice) => {
    if (window.fbq && selectedItem) {
      window.fbq("track", "AddToCart", {
        content_ids: [selectedItem.id],
        content_name: selectedItem.name,
        content_type: "product",
        value: totalPrice,
        currency: "XAF",
        availability: selectedItem.available ? "in stock" : "out of stock",
        num_items: quantity,
      });
    }
  };

  const trackInitiateCheckout = () => {
    if (window.fbq && selectedItem) {
      const totalPrice = calculateTotalPrice();
      window.fbq("track", "InitiateCheckout", {
        content_ids: [selectedItem.id],
        content_name: selectedItem.name,
        content_type: "product",
        value: totalPrice,
        currency: "XAF",
        availability: selectedItem.available ? "in stock" : "out of stock",
        num_items: quantity,
      });
    }
  };

  // Schema.org JSON-LD
  const generateSchemaOrgJSONLD = useCallback(() => {
    if (!product) return null;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "productID": product.id,
      "name": product.name,
      "description": product.description,
      "image": product.covers?.[0] || "https://via.placeholder.com/300x200?text=Aucune+image",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "XAF",
        "price": product.priceType === "sizes" && product.sizes
          ? convertPrice(Object.values(product.sizes)[0] || "0").toString()
          : convertPrice(product.price || "0").toString(),
        "availability": product.available
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        "url": `http://localhost:3000/detail/${product.id}`,
      },
    };
  }, [product]);

  // Métadonnées SEO
  const pageTitle = product ? `${product.name} - Mange d'abord` : "Article - Mange d'abord";
  const pageDescription = product?.description || `Découvrez ${product?.name || "cet article"} sur Mange d'abord.`;
  const pageImage = product?.covers?.[0] || "https://via.placeholder.com/300x200?text=Aucune+image";
  const pageUrl = `http://localhost:3000/detail/${id || "produit"}`;

  // Récupérer les données
  useEffect(() => {
    fetchProductDetails();
    fetchRecommendedProducts();
  }, [id]);

  // Gérer le suivi et JSON-LD
  useEffect(() => {
    if (product) {
      trackViewContent(product);

      const schemaData = generateSchemaOrgJSONLD();
      if (schemaData) {
        const existingScript = document.querySelector('script[type="application/ld+json"]');
        if (existingScript) existingScript.remove();
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.text = JSON.stringify(schemaData);
        document.head.appendChild(script);

        return () => {
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
        };
      }
    }
  }, [product, generateSchemaOrgJSONLD]);

  // Paramètres du slider
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

  const renderStars = useCallback((rating) => {
    const totalStars = 5;
    return [...Array(totalStars)].map((_, i) => (
      <i
        key={i}
        className={`icofont-star ${i < rating ? "text-yellow-400" : "text-gray-300"}`}
        aria-hidden="true"
      ></i>
    ));
  }, []);

  // Afficher les états de chargement, d'erreur ou vide
  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600 font-medium mb-4">{error}</p>
        <Link
          to="/accueil"
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-600 mb-4">Aucun produit trouvé.</p>
        <Link
          to="/accueil"
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / reviews.length
      : 0;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta
          name="keywords"
          content={`${product.name || "article"}, Mange d'abord, restauration, commande en ligne`}
        />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={pageImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="Mange d'abord" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={pageImage} />
      </Helmet>

      {successMessage && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">
          {successMessage}
        </div>
      )}

      <div className="p-3 bg-white shadow-sm">
        <div className="flex items-center">
          <Link to="/accueil" className="text-green-600 font-bold flex items-center">
            <i className="icofont-rounded-left mr-2"></i> Retour
          </Link>
          <div className="ml-auto flex items-center">
            <Link
              to="#"
              className="bg-red-500 p-2 rounded-full shadow-sm text-white"
              aria-label="Ajouter aux favoris"
            >
              <i className="icofont-heart"></i>
            </Link>
            <Link
              to="#"
              className="bg-green-500 p-2 rounded-full shadow-sm text-white ml-2"
              aria-label="Partager"
            >
              <i className="icofont-share"></i>
            </Link>
            <button className="ml-3" aria-label="Menu de navigation">
              <i className="icofont-navigation-menu"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2 bg-white shadow-sm">
        <h2 className="text-xl font-bold">{product.name}</h2>
        <div className="flex items-center mt-1">
          <div className="flex" aria-label={`Note moyenne : ${averageRating} étoiles`}>
            {renderStars(Math.round(averageRating))}
          </div>
          <p className="ml-2 text-gray-600 text-sm">({reviews.length} Avis)</p>
        </div>
        <div className="flex items-center mt-2">
          {product.priceType === "sizes" ? (
            Object.keys(product.sizes || {}).length > 0 &&
            Object.values(product.sizes).some((price) => price && convertPrice(price) > 0) ? (
              <p className="text-lg font-bold text-gray-800">
                {Object.entries(product.sizes)
                  .filter(([_, price]) => price && convertPrice(price) > 0)
                  .map(([size, price], index, filtered) => (
                    <span key={size}>
                      {size}: {formatPrice(price)}
                      {index < filtered.length - 1 ? ", " : ""}
                    </span>
                  ))}
              </p>
            ) : (
              <p className="text-red-600 text-lg">Aucune taille disponible</p>
            )
          ) : (
            <p className="text-lg font-bold text-gray-800">{formatPrice(product.price)}</p>
          )}
          {product.discount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {product.discount}% OFF
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Disponibilité : {product.available ? "En stock" : "Rupture de stock"}
        </p>
      </div>

      <div className="px-3 py-2 bg-white mt-2">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Livraison</p>
            <p className="text-sm font-semibold">À partir de 1000 FCFA</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Disponible en</p>
            <p className="text-sm font-semibold">
              {product.saleMode === "pack" ? "Pack" : product.saleMode === "kilo" ? "Kilo" : "Unité"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white py-3 mt-2">
        <Slider {...sliderSettings}>
          {(product.covers || []).map((cover, index) => (
            <div key={index} className="px-2">
              <img
                src={cover || "https://via.placeholder.com/300x200?text=Aucune+image"}
                alt={`Image ${index + 1} du produit ${product.name}`}
                className="w-full h-64 object-cover rounded-lg shadow-md"
                loading="lazy"
              />
            </div>
          ))}
        </Slider>
      </div>

      <div className="bg-white p-3 mt-2">
        <h6 className="font-bold mb-2">Infos sur le produit</h6>
        <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
      </div>

      <div className="bg-white p-3 mt-2">
        <h6 className="font-bold mb-2">Avis</h6>
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-200 py-3">
              <div className="flex items-center">
                <div className="flex" aria-label={`Note : ${review.rating} étoiles`}>
                  {renderStars(review.rating)}
                </div>
                <span className="ml-2 text-sm text-gray-500">{review.date}</span>
              </div>
              <p className="mt-1 text-gray-700 text-sm">{review.comment}</p>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm">Aucun avis pour ce produit.</p>
        )}
      </div>

      <div className="bg-white p-3 mt-2">
        <h6 className="font-bold mb-3">Recommandations</h6>
        <div className="grid grid-cols-2 gap-3">
          {recommendedProducts.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100"
            >
              <Link to={`/detail/${item.id}`} className="block">
                <div className="relative w-48 h-48 mx-auto bg-gray-100 rounded-t">
                  {item.discount > 0 && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {item.discount}% OFF
                    </span>
                  )}
                  <img
                    src={(item.covers || [])[0] || "https://via.placeholder.com/300x200?text=Aucune+image"}
                    alt={`Produit ${item.name}`}
                    className="w-48 h-48 object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <h6 className="font-semibold text-sm truncate">{item.name}</h6>
                  <div className="flex items-center justify-between mt-2">
                    {item.priceType === "sizes" ? (
                      Object.keys(item.sizes || {}).length > 0 &&
                      Object.values(item.sizes).some((price) => price && convertPrice(price) > 0) ? (
                        <p className="text-green-500 font-bold text-sm truncate">
                          {Object.entries(item.sizes)
                            .filter(([_, price]) => price && convertPrice(price) > 0)
                            .map(([size, price], index, filtered) => (
                              <span key={size}>
                                {size}: {formatPrice(price)}
                                {index < filtered.length - 1 ? ", " : ""}
                              </span>
                            ))}
                        </p>
                      ) : (
                        <p className="text-red-600 text-sm">Aucune taille disponible</p>
                      )
                    ) : (
                      <p className="text-green-500 font-bold text-sm">{formatPrice(item.price)}</p>
                    )}
                    <button
                      className="bg-green-500 text-white text-sm px-3 py-1 rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      onClick={(e) => {
                        e.preventDefault();
                        if (!item.available) return;
                        setSelectedItem(item);
                        setSelectedExtras({});
                        setValidationError(null);
                        if (item.priceType === "sizes" && item.sizes) {
                          const validSize = Object.keys(item.sizes).find(
                            (size) => item.sizes[size] && convertPrice(item.sizes[size]) > 0
                          );
                          if (validSize) {
                            setSelectedSizes((prev) => ({ ...prev, [item.id]: validSize }));
                          }
                        }
                        console.log(`Produit recommandé sélectionné : ${item.name} (${item.id})`);
                      }}
                      disabled={!item.available}
                      aria-label={`Ajouter ${item.name} au panier`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
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
                  setSelectedSizes({});
                  setValidationError(null);
                  setQuantity(1);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl focus:outline-none focus:ring-2 focus:ring-gray-500"
                aria-label="Fermer la modale"
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
                  <span>{validationError}</span>
                  <button
                    className="absolute top-0 right-0 px-2 py-1 text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    onClick={() => setValidationError(null)}
                    aria-label="Fermer l'erreur"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="mb-6">
                <h4 className="font-medium mb-3 text-gray-700">Quantité</h4>
                <div className="flex items-center">
                  <button
                    className="bg-green-500 text-white px-3 py-1 rounded-full hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={!selectedItem.available}
                    aria-label="Diminuer la quantité"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    className="w-10 text-center mx-2 border border-gray-300 rounded"
                    value={quantity}
                    readOnly
                    aria-label={`Quantité sélectionnée : ${quantity}`}
                  />
                  <button
                    className="bg-green-500 text-white px-3 py-1 rounded-full hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500"
                    onClick={() => handleQuantityChange(1)}
                    disabled={!selectedItem.available}
                    aria-label="Augmenter la quantité"
                  >
                    +
                  </button>
                </div>
              </div>

              {selectedItem.priceType === "sizes" &&
              Object.keys(selectedItem.sizes || {}).length > 0 &&
              Object.values(selectedItem.sizes).some((price) => price && convertPrice(price) > 0) ? (
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-gray-700">
                    Taille <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(selectedItem.sizes)
                      .filter(([_, price]) => price && convertPrice(price) > 0)
                      .map(([size, price]) => (
                        <label
                          key={size}
                          htmlFor={`size-${selectedItem.id}-${size}`}
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
                            id={`size-${selectedItem.id}-${size}`}
                            type="radio"
                            name={`size-${selectedItem.id}`}
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
                            aria-label={`Taille ${size} pour ${formatPrice(price)}`}
                          />
                          <div className="ml-3 flex-1">
                            <span className="text-gray-700">{size}</span>
                            <span className="text-sm text-gray-500 ml-2">{formatPrice(price)}</span>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
              ) : selectedItem.priceType === "sizes" ? (
                <p className="text-red-600 text-sm mb-6">Aucune taille disponible</p>
              ) : null}

              {selectedItem.assortments?.length === 0 ? (
                selectedItem.priceType !== "sizes" && (
                  <p className="text-gray-500 text-center mb-6">Aucun complément associé à ce plat.</p>
                )
              ) : (
                selectedItem.assortments.map((assortmentId) => {
                  const extraList = extraLists.find((el) => el.id === assortmentId);
                  if (!extraList) return null;

                  const hasError = validationError?.includes(extraList.name);

                  return (
                    <div key={extraList.id} className="mb-6">
                      <h4 className={`font-medium mb-3 text-gray-700 ${hasError ? "text-red-600" : ""}`}>
                        {extraList.name}
                        {extraList.extraListElements?.some((el) => el.required) && (
                          <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {extraList.extraListElements?.map((el, index) => (
                          <label
                            key={index}
                            htmlFor={`extra-${assortmentId}-${index}`}
                            className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                              selectedExtras[assortmentId]?.includes(index)
                                ? "bg-green-50 border-2 border-green-200"
                                : "border border-gray-200 hover:border-green-200"
                            } ${
                              el.required &&
                              hasError &&
                              !selectedExtras[assortmentId]?.includes(index)
                                ? "border-red-400 bg-red-50"
                                : ""
                            }`}
                          >
                            <input
                              id={`extra-${assortmentId}-${index}`}
                              type={el.multiple ? "checkbox" : "radio"}
                              name={el.multiple ? undefined : `extra-${assortmentId}`}
                              checked={selectedExtras[assortmentId]?.includes(index) || false}
                              onChange={(e) => {
                                setValidationError(null);
                                const newSelection = [...(selectedExtras[assortmentId] || [])];
                                if (el.multiple) {
                                  e.target.checked
                                    ? newSelection.push(index)
                                    : newSelection.splice(newSelection.indexOf(index), 1);
                                } else {
                                  newSelection.length = 0;
                                  newSelection.push(index);
                                }
                                setSelectedExtras({
                                  ...selectedExtras,
                                  [assortmentId]: newSelection,
                                });
                              }}
                              className="form-checkbox h-5 w-5 text-green-600 focus:ring-green-500"
                              aria-required={el.required}
                              aria-invalid={
                                el.required &&
                                hasError &&
                                !selectedExtras[assortmentId]?.includes(index)
                              }
                              aria-label={`${el.name}${el.price ? ` pour ${formatPrice(el.price)}` : ""}`}
                            />
                            <div className="ml-3 flex-1">
                              <span className="text-gray-700">{el.name}</span>
                              {el.price && (
                                <span className="text-sm text-gray-500 ml-2">+ {formatPrice(el.price)}</span>
                              )}
                            </div>
                            {el.required && (
                              <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">Obligatoire</span>
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
                    setSelectedSizes({});
                    setValidationError(null);
                    setQuantity(1);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 flex-1"
                  aria-label="Annuler la sélection"
                >
                  Annuler
                </button>
                <button
                  onClick={() => addProductToCart(false)}
                  disabled={!validateExtras().isValid || !selectedItem.available}
                  className={`px-4 py-2 rounded-lg flex-1 transition-all duration-200 ${
                    validateExtras().isValid && selectedItem.available
                      ? "bg-green-600 text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  aria-label={`Confirmer pour ${formatPrice(calculateTotalPrice())}`}
                >
                  Confirmer ({formatPrice(calculateTotalPrice())})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md">
        <div className="flex">
          <button
            className="w-1/4 flex items-center justify-center bg-yellow-400 text-white py-3 text-lg hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-500"
            onClick={() => handleCartAction(false)}
            disabled={!product.available}
            aria-label="Ajouter au panier"
          >
            <FaShoppingCart className="text-2xl" />
          </button>
          <button
            className="w-3/4 flex items-center justify-center bg-green-500 text-white py-3 text-lg font-semibold hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500"
            onClick={() => handleCartAction(true)}
            disabled={!product.available}
            aria-label="Ajouter à ma commande"
          >
            Ajouter à ma commande
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;