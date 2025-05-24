import React, { useMemo, useEffect, useState } from "react";
import { useCart } from "../context/cartcontext";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity } = useCart();
  const navigate = useNavigate();
  const [extraLists, setExtraLists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch extras
  useEffect(() => {
    const fetchExtraLists = async () => {
      try {
        setIsLoading(true);
        const querySnapshot = await getDocs(collection(db, "extraLists"));
        setExtraLists(
          querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (error) {
        console.error("Error fetching extras:", error);
        toast.error("Erreur lors du chargement des extras.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchExtraLists();
  }, []);

  const getExtraDetails = (extraListId, elementIndex) => {
    const extraList = extraLists.find((el) => el.id === extraListId);
    if (!extraList || !extraList.extraListElements) {
      return { name: "Option inconnue", price: 0 };
    }
    const element = extraList.extraListElements[elementIndex];
    return {
      name: element?.name || "Option supprimée",
      price: element?.price || 0,
    };
  };

  const convertPrice = (price) => {
    if (typeof price === "string") {
      return parseFloat(price.replace(/\./g, ""));
    }
    return Number(price);
  };

  // Calculate total
  const total = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      let itemTotal = convertPrice(item.price) * item.quantity;
      if (item.selectedExtras) {
        Object.entries(item.selectedExtras).forEach(([extraListId, indexes]) => {
          indexes.forEach((index) => {
            const { price } = getExtraDetails(extraListId, index);
            itemTotal += convertPrice(price) * item.quantity;
          });
        });
      }
      return acc + itemTotal;
    }, 0);
  }, [cartItems, extraLists]);

  const thresholdAmount = 5000;

  // Calculate loyalty points
  const points = useMemo(() => {
    if (total >= thresholdAmount) {
      const credit = total * 0.1;
      return Math.floor(credit / 100);
    }
    return 0;
  }, [total]);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.warn("Votre panier est vide. Ajoutez des articles avant de commander.");
      return;
    }

    const restaurantId = cartItems[0]?.restaurantId;
    if (!restaurantId) {
      toast.error("Erreur : Aucun restaurant associé au panier.");
      return;
    }

    const allSameRestaurant = cartItems.every(
      (item) => item.restaurantId === restaurantId
    );
    if (!allSameRestaurant) {
      toast.error("Vous ne pouvez commander que depuis un seul restaurant à la fois.");
      return;
    }

    navigate("/order-details", { state: { restaurantId } });
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-pulse space-y-4 w-full max-w-md px-4">
          <div className="h-10 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gray-50 px-4">
        <p className="text-center text-lg sm:text-xl text-gray-600 mb-6">Votre panier est vide</p>
        <Link
          to="/accueil"
          className="bg-green-600 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-full hover:bg-green-700 transition-all duration-300 shadow-lg"
        >
          Découvrir la boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <h2 className="text-center font-bold text-xl sm:text-2xl text-gray-800">Votre Panier</h2>
      </header>

      {/* Main Content */}
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-32">
        {/* Cart Items */}
        <ul className="space-y-4">
          {cartItems.map((item) => (
            <li
              key={item.id}
              className="bg-white rounded-xl sm:rounded-2xl shadow-md p-4 flex items-start space-x-3 sm:space-x-4 transition-all hover:shadow-lg"
            >
              <img
                src={item.covers?.[0] || "/img/default-food.png"}
                alt={item.name}
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-base sm:text-lg text-gray-800">{item.name}</h3>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-600 transition-colors"
                    aria-label="Supprimer l'article"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
                <p className="mt-1 text-green-600 font-medium text-sm sm:text-base">
                  {convertPrice(item.price).toLocaleString()} FCFA
                </p>

                {item.selectedExtras && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(item.selectedExtras).map(([extraListId, indexes]) => {
                      const extraList = extraLists.find((el) => el.id === extraListId);
                      return (
                        <div key={extraListId}>
                          <p className="text-xs sm:text-sm font-medium text-gray-600">
                            {extraList?.name || "Extras"} :
                          </p>
                          <ul className="list-disc list-inside ml-4 text-xs sm:text-sm text-gray-500">
                            {indexes.map((idx) => {
                              const { name, price } = getExtraDetails(extraListId, idx);
                              return (
                                <li key={idx}>
                                  {name} (+{convertPrice(price).toLocaleString()} FCFA)
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 sm:mt-4 flex items-center space-x-3 sm:space-x-4">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity === 1}
                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    aria-label="Diminuer la quantité"
                  >
                    −
                  </button>
                  <span className="font-medium text-gray-700 text-sm sm:text-base">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                    aria-label="Augmenter la quantité"
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Loyalty Card */}
        {total < thresholdAmount ? (
          <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-md flex items-center space-x-3 sm:space-x-4">
            <i className="fas fa-gift text-2xl sm:text-3xl text-yellow-600"></i>
            <div>
              <h4 className="font-bold text-base sm:text-lg text-yellow-800">Boostez votre fidélité !</h4>
              <p className="text-yellow-700 text-sm sm:text-base">
                Ajoutez{" "}
                <span className="font-semibold">
                  {(thresholdAmount - total).toLocaleString()} FCFA
                </span>{" "}
                pour débloquer vos points fidélité{" "}
                <span className="italic">(1 point = 100 FCFA)</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-green-100 to-green-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-md flex items-center space-x-3 sm:space-x-4">
            <i className="fas fa-award text-2xl sm:text-3xl text-green-600"></i>
            <div>
              <h4 className="font-bold text-base sm:text-lg text-green-800">Félicitations !</h4>
              <p className="text-green-700 text-sm sm:text-base">
                Vous gagnez{" "}
                <span className="font-semibold">{points} points</span> (soit{" "}
                {(points * 100).toLocaleString()} FCFA de crédit)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white shadow-inner p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <span className="font-semibold text-base sm:text-lg text-gray-700">Total :</span>
            <span className="font-bold text-2xl sm:text-3xl text-green-600">
              {total.toLocaleString()} FCFA
            </span>
          </div>
          <button
            onClick={handleCheckout}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2 sm:py-3 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center text-sm sm:text-base"
          >
            <i className="fas fa-check-circle mr-2"></i>
            Commander maintenant
          </button>
        </div>
      </footer>

      {/* Navigation */}
      <nav className="fixed bottom-0 w-full bg-white shadow-lg grid grid-cols-4 text-center z-20">
        <Link
          to="/accueil"
          className="py-2 sm:py-3 text-gray-600 hover:text-green-600 transition-colors"
        >
          <i className="fas fa-home text-lg sm:text-xl mb-1"></i>
          <span className="block text-xs">Boutique</span>
        </Link>
        <Link to="/cart" className="py-2 sm:py-3 text-green-600 font-semibold">
          <i className="fas fa-shopping-cart text-lg sm:text-xl mb-1"></i>
          <span className="block text-xs">Panier</span>
        </Link>
        <Link
          to="/orders"
          className="py-2 sm:py-3 text-gray-600 hover:text-green-600 transition-colors"
        >
          <i className="fas fa-shopping-bag text-lg sm:text-xl mb-1"></i>
          <span className="block text-xs">Commandes</span>
        </Link>
        <Link
          to="/profile"
          className="py-2 sm:py-3 text-gray-600 hover:text-green-600 transition-colors"
        >
          <i className="fas fa-user text-lg sm:text-xl mb-1"></i>
          <span className="block text-xs">Compte</span>
        </Link>
      </nav>

      {/* Toast Container */}
      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        className="mb-16 sm:mb-0"
      />
    </div>
  );
};

export default CartPage;