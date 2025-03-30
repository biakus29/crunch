import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useCart } from "../context/cartcontext";
import { FaShoppingCart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const ProductDetails = () => {
  // Récupérer l'ID du produit depuis l'URL
  const { id } = useParams();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  // États locaux
  const [product, setProduct] = useState(null);
  const [availableSupplements, setAvailableSupplements] = useState([]);
  const [selectedSupplement, setSelectedSupplement] = useState(null);
  const [availableExtras, setAvailableExtras] = useState([]);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- FONCTIONS D'APPEL À FIRESTORE ---

  // Récupérer les avis
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

  // Récupérer les détails du produit
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
      // Correction éventuelle de la clé needAssortement
      const fixedProductData = {
        ...productData,
        needAssortment: productData.needAssortement,
      };
      setProduct({ id: productSnapshot.id, ...fixedProductData });

      // Si le produit nécessite un assortiment, récupérer les suppléments associés
      if (fixedProductData.needAssortment && fixedProductData.assortments) {
        const supplements = await Promise.all(
          fixedProductData.assortments.map(async (assortmentId) => {
            const assortmentRef = doc(db, "assortments", assortmentId);
            const assortmentSnap = await getDoc(assortmentRef);
            return assortmentSnap.exists()
              ? { id: assortmentSnap.id, ...assortmentSnap.data() }
              : null;
          })
        );
        const validSupplements = supplements.filter(Boolean);
        setAvailableSupplements(validSupplements);
        if (validSupplements.length > 0) {
          setSelectedSupplement(validSupplements[0]);
        }
      }

      // Récupérer les extras si disponibles
      if (fixedProductData.extraLists) {
        const extras = await Promise.all(
          fixedProductData.extraLists.map(async (extraListId) => {
            const extraListRef = doc(db, "extraLists", extraListId);
            const extraListSnap = await getDoc(extraListRef);
            return extraListSnap.exists()
              ? { id: extraListSnap.id, ...extraListSnap.data() }
              : null;
          })
        );
        const validExtras = extras.filter(Boolean);
        setAvailableExtras(validExtras);
      }
    } catch (err) {
      setError("Erreur lors de la récupération des détails du produit.");
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les produits recommandés
  const fetchRecommendedProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "items"));
      const recommendedData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Nom inconnu",
        price: doc.data().price || "0",
        covers: doc.data().covers || [],
        discount: doc.data().discount || 0,
      }));
      setRecommendedProducts(recommendedData);
    } catch (err) {
      setError("Erreur lors de la récupération des produits recommandés.");
    }
  };

  // --- FONCTIONS LIÉES À L'INTERFACE ---

  // Gérer la redirection vers la page d'adresses
  const handleBuyClick = () => {
    navigate("/addresses");
  };

  // Gérer la quantité (incrément/décrément)
  const handleQuantityChange = (delta) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  // Ajout du produit au panier via le contexte
  const addProductToCart = () => {
    if (!product) {
      alert("Le produit n'est pas encore chargé.");
      return;
    }

    if (product.needAssortment && !selectedSupplement) {
      alert("Veuillez choisir un supplément avant d'ajouter au panier.");
      return;
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: (product.covers || [])[0],
      description: product.description,
      quantity: quantity,
      supplement: selectedSupplement,
      extras: selectedExtras,
    });
    alert("Produit ajouté au panier !");
  };

  // --- USE EFFECTS ---
  useEffect(() => {
    fetchReviews();
  }, [id]);

  useEffect(() => {
    fetchProductDetails();
    fetchRecommendedProducts();
  }, [id]);

  // --- AFFICHAGE ---

  // Slider settings
  const sliderSettings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  // États de chargement / erreur
  if (loading) {
    return <p className="p-4 text-center">Chargement des données...</p>;
  }
  if (error) {
    return <p className="p-4 text-center text-red-600">{error}</p>;
  }
  if (!product) {
    return <p className="p-4 text-center">Aucun produit trouvé.</p>;
  }

  // Calculer la note moyenne pour l'affichage
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) /
        reviews.length
      : 0;

  // Fonction d'affichage des étoiles
  const renderStars = (rating) => {
    const totalStars = 5;
    return [...Array(totalStars)].map((_, i) => (
      <i
        key={i}
        className={`icofont-star ${
          i < rating ? "text-yellow-400" : "text-gray-300"
        }`}
      ></i>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Top header */}
      <div className="p-3 bg-white shadow-sm">
        <div className="flex items-center">
          <Link to="/" className="text-green-600 font-bold flex items-center">
            <i className="icofont-rounded-left mr-2"></i> Back
          </Link>
          <div className="ml-auto flex items-center">
            <Link
              to="#"
              className="bg-red-500 p-2 rounded-full shadow-sm text-white"
            >
              <i className="icofont-heart"></i>
            </Link>
            <Link
              to="#"
              className="bg-green-500 p-2 rounded-full shadow-sm text-white ml-2"
            >
              <i className="icofont-share"></i>
            </Link>
            <button className="ml-3">
              <i className="icofont-navigation-menu"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Product Name, Rating, Price, Discount */}
      <div className="px-3 pt-3 pb-2 bg-white shadow-sm">
        <h2 className="text-xl font-bold">{product.name}</h2>
        <div className="flex items-center mt-1">
          <div className="flex">{renderStars(Math.round(averageRating))}</div>
          <p className="ml-2 text-gray-600 text-sm">({reviews.length} Avis)</p>
        </div>
        <div className="flex items-center mt-2">
          <p className="text-lg font-bold text-gray-800">{product.price} FCFA</p>
          {product.discount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {product.discount}% OFF
            </span>
          )}
        </div>
      </div>

      {/* Delivery & "Available in" */}
      <div className="px-3 py-2 bg-white mt-2">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Livraison</p>
            <p className="text-sm font-semibold">A partir de 1000 FCFA</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Disponible en </p>
            <p className="text-sm font-semibold">
              {product.saleMode === "pack" ? "Pack" : "Unit"}
            </p>
          </div>
        </div>
      </div>

      {/* Product Image Carousel */}
      <div className="bg-white py-3 mt-2">
        <Slider {...sliderSettings}>
          {(product.covers || []).map((cover, index) => (
            <div key={index} className="px-2">
              <img
                src={cover}
                alt={`Product ${index + 1}`}
                className="w-full h-48 object-cover rounded-md shadow-sm"
              />
            </div>
          ))}
        </Slider>
      </div>

      {/* Quantity + Buttons */}
      <div className="bg-white p-3 mt-2">
        <p className="font-semibold text-gray-700 mb-2">Choisis ta quantité</p>
        <div className="flex items-center">
          <button
            className="bg-green-500 text-white px-3 py-1 rounded-full"
            onClick={() => handleQuantityChange(-1)}
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
          >
            +
          </button>
        </div>
      </div>

      {/* Supplements (Assortments) */}
      {product.needAssortment && availableSupplements.length > 0 && (
        <div className="bg-white p-3 mt-2">
          <h6 className="font-bold mb-2">Choisis ton supplement</h6>
          <div className="flex flex-wrap gap-2">
            {availableSupplements.map((sup) => (
              <button
                key={sup.id}
                className={`px-4 py-2 border rounded-full ${
                  selectedSupplement && selectedSupplement.id === sup.id
                    ? "border-green-500 text-white bg-green-500"
                    : "border-gray-300 text-gray-700"
                }`}
                onClick={() => setSelectedSupplement(sup)}
              >
                {sup.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extras */}
      {availableExtras.length > 0 && (
        <div className="bg-white p-3 mt-2">
          <h6 className="font-bold mb-2">Choisis tes extras</h6>
          <div className="flex flex-wrap gap-2">
            {availableExtras.map((extra) => {
              const isSelected = selectedExtras.some((e) => e.id === extra.id);
              return (
                <button
                  key={extra.id}
                  className={`px-4 py-2 border rounded-full ${
                    isSelected
                      ? "border-green-500 text-white bg-green-500"
                      : "border-gray-300 text-gray-700"
                  }`}
                  onClick={() =>
                    setSelectedExtras((prev) =>
                      isSelected
                        ? prev.filter((e) => e.id !== extra.id)
                        : [...prev, extra]
                    )
                  }
                >
                  {extra.name}
                  {extra.price ? ` (+${extra.price} FCFA)` : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Description */}
      <div className="bg-white p-3 mt-2">
        <h6 className="font-bold mb-2">Infos sur le produit</h6>
        <p className="text-gray-600 text-sm leading-relaxed">
          {product.description}
        </p>
      </div>

      {/* Ratings & Reviews */}
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
                      className={`icofont-star ${
                        index < review.rating
                          ? "text-yellow-400"
                          : "text-gray-300"
                      }`}
                    ></i>
                  ))}
                </div>
                <span className="ml-2 text-sm text-gray-500">
                  {review.date}
                </span>
              </div>
              <p className="mt-1 text-gray-700 text-sm">{review.comment}</p>
            </div>
          ))
        ) : (
          <p className="text-gray-500">Aucun avis pour ce produit.</p>
        )}
      </div>

      {/* Recommended Products */}
      <div className="bg-white p-3 mt-2">
        <h6 className="font-bold mb-3">Recommandations</h6>
        <div className="grid grid-cols-2 gap-3">
          {recommendedProducts.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100"
            >
              <Link to={`/detail/${item.id}`} className="block">
                <div className="relative">
                  {item.discount > 0 && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {item.discount}% OFF
                    </span>
                  )}
                  <img
                    src={(item.covers || [])[0]}
                    alt={item.name}
                    className="w-full h-32 object-cover"
                  />
                </div>
                <div className="p-3">
                  <h6 className="font-semibold text-sm">{item.name}</h6>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-green-500 font-bold text-sm">
                      {item.price} FCFA
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

      {/* Bottom Bar: Add to Cart / Buy */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md">
        <div className="flex">
          <button
            className="w-1/4 flex items-center justify-center bg-yellow-400 text-white py-3 text-lg"
            onClick={addProductToCart}
          >
            <FaShoppingCart className="text-2xl" />
          </button>
          <button
            className="w-3/4 flex items-center justify-center bg-green-500 text-white py-3 text-lg font-semibold"
            onClick={handleBuyClick}
          >
            Achete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
