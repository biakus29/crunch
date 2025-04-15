import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { Link, useParams, useNavigate } from "react-router-dom";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useCart } from "../context/cartcontext";
import { FaShoppingCart } from "react-icons/fa";

const ProductDetails = () => {
  const { id } = useParams();
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
  const [successMessage, setSuccessMessage] = useState("");

  // --- FONCTIONS D'APPEL À FIRESTORE ---
  const fetchReviews = async () => {
    try {
      const reviewsRef = collection(db, "items", id, "reviews");
      const reviewsSnapshot = await getDocs(reviewsRef);
      const reviewsData = reviewsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setReviews(reviewsData);
    } catch (error) {
      console.error("Erreur lors du chargement des avis :", error);
    }
  };

  const fetchProductDetails = async () => {
    if (!id) {
      setError("ID du produit non trouvé dans l'URL.");
      return;
    }
    setLoading(true);
    try {
      const productRef = doc(db, "items", id);
      const productSnapshot = await getDoc(productRef);
      if (!productSnapshot.exists()) {
        setError("Produit non trouvé.");
        return;
      }
      const productData = productSnapshot.data();
      if (!productData) {
        setError("Données du produit manquantes.");
        return;
      }
      const finalProductData = {
        id: productSnapshot.id,
        ...productData,
        available: productData.available !== undefined ? productData.available : true, // Valeur par défaut
      };
      setProduct(finalProductData);

      const extraListsSnapshot = await getDocs(collection(db, "extraLists"));
      const extraListsData = extraListsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setExtraLists(extraListsData);
    } catch (err) {
      setError("Erreur lors de la récupération des détails du produit.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendedProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "items"));
      const recommendedData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Nom inconnu",
        price: doc.data().price || "0",
        covers: doc.data().covers || [],
        discount: doc.data().discount || 0,
        available: doc.data().available !== undefined ? doc.data().available : true,
      }));
      setRecommendedProducts(recommendedData);
    } catch (err) {
      setError("Erreur lors de la récupération des produits recommandés.");
    }
  };

  // --- FONCTIONS UTILITAIRES ---
  const convertPrice = (price) => {
    if (typeof price === "string") {
      const cleanedPrice = price.replace(/[^0-9,.]/g, "").replace(",", ".");
      return parseFloat(cleanedPrice) || 0;
    }
    return Number(price) || 0;
  };

  const validateExtras = () => {
    if (!selectedItem) return false;
    return selectedItem.assortments.every((assortmentId) => {
      const extraList = extraLists.find((el) => el.id === assortmentId);
      const requiredElements = extraList?.extraListElements?.filter((el) => el.required) || [];
      if (requiredElements.length === 0) return true;
      const selected = selectedExtras[assortmentId] || [];
      return selected.length > 0;
    });
  };

  const calculateTotalPrice = () => {
    let total = selectedItem ? convertPrice(selectedItem.price) * quantity : 0;
    Object.entries(selectedExtras).forEach(([assortmentId, indexes]) => {
      const extraList = extraLists.find((el) => el.id === assortmentId);
      if (extraList && extraList.extraListElements) {
        indexes.forEach((index) => {
          const extra = extraList.extraListElements[index];
          if (extra && extra.price) {
            total += convertPrice(extra.price) * quantity;
          }
        });
      }
    });
    return total;
  };

  const handleQuantityChange = (delta) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const handleAddClick = () => {
    if (product.assortments?.length > 0) {
      setSelectedItem(product);
      setSelectedExtras({});
    } else {
      addProductToCart();
    }
  };

  const handleBuyClick = () => {
    if (product.assortments?.length > 0) {
      setSelectedItem(product);
      setSelectedExtras({});
    } else {
      addProductToCart();
      navigate("/addresses");
      trackInitiateCheckout();
    }
  };

  const addProductToCart = () => {
    const totalPrice = calculateTotalPrice();
    const cartItem = {
      id: product.id,
      name: product.name,
      price: convertPrice(product.price),
      image: (product.covers || [])[0],
      description: product.description,
      quantity: quantity,
      selectedExtras: selectedItem ? selectedExtras : {},
      available: product.available,
    };

    addToCart(cartItem);
    setSuccessMessage(`${product.name} ajouté au panier !`);
    setTimeout(() => setSuccessMessage(""), 3000);
    setSelectedItem(null);

    trackAddToCart(totalPrice);
  };

  // --- FONCTIONS DE SUIVI PIXEL ET MICRODONNÉES ---
  const trackViewContent = (price) => {
    if (window.fbq && product) {
      window.fbq("track", "ViewContent", {
        content_ids: [product.id],
        content_name: product.name,
        content_type: "product",
        value: price,
        currency: "XAF",
        availability: product.available ? "in stock" : "out of stock",
      });
    }
  };

  const trackAddToCart = (totalPrice) => {
    if (window.fbq && product) {
      window.fbq("track", "AddToCart", {
        content_ids: [product.id],
        content_name: product.name,
        content_type: "product",
        value: totalPrice,
        currency: "XAF",
        availability: product.available ? "in stock" : "out of stock",
        num_items: quantity,
      });
    }
  };

  const trackInitiateCheckout = () => {
    if (window.fbq && product) {
      const totalPrice = calculateTotalPrice();
      window.fbq("track", "InitiateCheckout", {
        content_ids: [product.id],
        content_name: product.name,
        content_type: "product",
        value: totalPrice,
        currency: "XAF",
        availability: product.available ? "in stock" : "out of stock",
        num_items: quantity,
      });
    }
  };

  const generateSchemaOrgJSONLD = () => {
    if (!product) return null;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "productID": product.id, // Utilisation de "productID" pour Meta
      "name": product.name,
      "description": product.description || "Description non disponible",
      "image": product.covers?.[0] || "https://www.mangedabord.com/logo192.png",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "XAF",
        "price": convertPrice(product.price || "0").toString(), // Toujours une string pour Meta
        "availability": product.available 
          ? "https://schema.org/InStock" 
          : "https://schema.org/OutOfStock",
        "url": `https://www.mangedabord.com/detail/${product.id}`,
      },
    };
  };

  // --- USE EFFECTS ---
  useEffect(() => {
    fetchReviews();
    fetchProductDetails();
    fetchRecommendedProducts();
  }, [id]);

  useEffect(() => {
    if (product) {
      trackViewContent(convertPrice(product.price));

      // Injecter les microdonnées Schema.org dans le DOM
      const schemaData = generateSchemaOrgJSONLD();
      if (schemaData) {
        const existingScript = document.querySelector('script[type="application/ld+json"]');
        if (existingScript) existingScript.remove(); // Supprimer l’ancien script
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.text = JSON.stringify(schemaData);
        document.head.appendChild(script);
      }
    }
  }, [product]);

  // --- AFFICHAGE ---
  const sliderSettings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  if (loading) {
    return <p className="p-4 text-center">Chargement des données...</p>;
  }
  if (error) {
    return <p className="p-4 text-center text-red-600">{error}</p>;
  }
  if (!product) {
    return <p className="p-4 text-center">Aucun produit trouvé.</p>;
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / reviews.length
      : 0;

  const renderStars = (rating) => {
    const totalStars = 5;
    return [...Array(totalStars)].map((_, i) => (
      <i
        key={i}
        className={`icofont-star ${i < rating ? "text-yellow-400" : "text-gray-300"}`}
      ></i>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {successMessage && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg z-50">
          {successMessage}
        </div>
      )}

      <div className="p-3 bg-white shadow-sm">
        <div className="flex items-center">
          <Link to="/" className="text-green-600 font-bold flex items-center">
            <i className="icofont-rounded-left mr-2"></i> Back
          </Link>
          <div className="ml-auto flex items-center">
            <Link to="#" className="bg-red-500 p-2 rounded-full shadow-sm text-white">
              <i className="icofont-heart"></i>
            </Link>
            <Link to="#" className="bg-green-500 p-2 rounded-full shadow-sm text-white ml-2">
              <i className="icofont-share"></i>
            </Link>
            <button className="ml-3">
              <i className="icofont-navigation-menu"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2 bg-white shadow-sm">
        <h2 className="text-xl font-bold">{product.name}</h2>
        <div className="flex items-center mt-1">
          <div className="flex">{renderStars(Math.round(averageRating))}</div>
          <p className="ml-2 text-gray-600 text-sm">({reviews.length} Avis)</p>
        </div>
        <div className="flex items-center mt-2">
          <p className="text-lg font-bold text-gray-800">
            {convertPrice(product.price).toLocaleString()} FCFA
          </p>
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
            <p className="text-sm text-gray-500">Disponible en </p>
            <p className="text-sm font-semibold">
              {product.saleMode === "pack" ? "Pack" : "Unit"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white py-3 mt-2">
        <Slider {...sliderSettings}>
          {(product.covers || []).map((cover, index) => (
            <div key={index} className="px-2">
              <img
                src={cover}
                alt={`Product ${index + 1}`}
                className="w-full h-64 object-cover rounded-lg shadow-md"
              />
            </div>
          ))}
        </Slider>
      </div>

      <div className="bg-white p-3 mt-2">
        <p className="font-semibold text-gray-700 mb-2">Choisis ta quantité</p>
        <div className="flex items-center">
          <button
            className="bg-green-500 text-white px-3 py-1 rounded-full"
            onClick={() => handleQuantityChange(-1)}
            disabled={!product.available}
          >
            -
          </button>
          <input
            type="text"
            className="w-10 text-center mx-2 border border-gray-300 rounded"
            value={quantity}
            readOnly
          />
          <button
            className="bg-green-500 text-white px-3 py-1 rounded-full"
            onClick={() => handleQuantityChange(1)}
            disabled={!product.available}
          >
            +
          </button>
        </div>
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
                <div className="flex">
                  {[...Array(5)].map((_, index) => (
                    <i
                      key={index}
                      className={`icofont-star ${index < review.rating ? "text-yellow-400" : "text-gray-300"}`}
                    ></i>
                  ))}
                </div>
                <span className="ml-2 text-sm text-gray-500">{review.date}</span>
              </div>
              <p className="mt-1 text-gray-700 text-sm">{review.comment}</p>
            </div>
          ))
        ) : (
          <p className="text-gray-500">Aucun avis pour ce produit.</p>
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
                    src={(item.covers || [])[0]}
                    alt={item.name}
                    className="w-48 h-48 object-cover"
                  />
                </div>
                <div className="p-3">
                  <h6 className="font-semibold text-sm">{item.name}</h6>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-green-500 font-bold text-sm">
                      {convertPrice(item.price).toLocaleString()} FCFA
                    </p>
                    <button className="bg-green-500 text-white text-sm px-3 py-1 rounded-full">
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
              <h3 className="text-lg font-semibold">Options disponibles</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-4">
              {selectedItem.assortments.map((assortmentId) => {
                const extraList = extraLists.find((el) => el.id === assortmentId);
                if (!extraList) return null;

                return (
                  <div key={extraList.id} className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">
                      {extraList.name}
                      {extraList.extraListElements?.some((el) => el.required) && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </h4>

                    <div className="space-y-2">
                      {extraList.extraListElements?.map((el, index) => (
                        <label
                          key={index}
                          className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
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
                                if (e.target.checked) {
                                  newSelection.push(index);
                                } else {
                                  newSelection.splice(newSelection.indexOf(index), 1);
                                }
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
              })}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex-1"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    if (validateExtras()) {
                      addProductToCart();
                      navigate("/cart");
                      trackInitiateCheckout();
                    }
                  }}
                  disabled={!validateExtras() || !product.available}
                  className={`px-4 py-2 rounded-lg flex-1 ${
                    validateExtras() && product.available
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

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md">
        <div className="flex">
          <button
            className="w-1/4 flex items-center justify-center bg-yellow-400 text-white py-3 text-lg"
            onClick={handleAddClick}
            disabled={!product.available}
          >
            <FaShoppingCart className="text-2xl" />
          </button>
          <button
            className="w-3/4 flex items-center justify-center bg-green-500 text-white py-3 text-lg font-semibold"
            onClick={handleBuyClick}
            disabled={!product.available}
          >
            Ajouter à ma commande
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;