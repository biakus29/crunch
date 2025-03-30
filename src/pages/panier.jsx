import React, { useMemo, useEffect, useState } from "react";
import { useCart } from "../context/cartcontext";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import '@fortawesome/fontawesome-free/css/all.min.css';

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity } = useCart();
  const navigate = useNavigate();
  const [extraLists, setExtraLists] = useState([]);

  useEffect(() => {
    const fetchExtraLists = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "extraLists"));
        setExtraLists(
          querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (error) {
        console.error("Erreur lors du chargement des extras :", error);
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
    if (typeof price === 'string') {
      return parseFloat(price.replace(/\./g, ''));
    }
    return Number(price);
  };

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

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      console.error("Le panier est vide.");
      alert("Votre panier est vide. Ajoutez des articles avant de commander.");
      return;
    }

    const restaurantId = cartItems[0]?.restaurantId;
    if (!restaurantId) {
      console.error("Aucun restaurantId trouvé dans le panier.");
      alert("Erreur : Aucun restaurant associé au panier.");
      return;
    }

    const allSameRestaurant = cartItems.every(item => item.restaurantId === restaurantId);
    if (!allSameRestaurant) {
      console.error("Les articles proviennent de différents restaurants.");
      alert("Vous ne pouvez commander que depuis un seul restaurant à la fois.");
      return;
    }

    navigate("/order-details", { state: { restaurantId } });
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <p className="text-center text-lg mb-4">Votre panier est vide</p>
        <Link
          to="/"
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          Voir la boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white border-b p-3 shadow-sm">
        <h2 className="text-center font-bold text-xl text-gray-800">
          Votre Panier
        </h2>
      </header>

      <div className="p-3">
        <ul className="space-y-3">
          {cartItems.map((item) => (
            <li
              key={item.id}
              className="bg-white rounded-lg shadow-md p-4 flex items-start relative"
            >
              <img
                src={item.covers?.[0] || "/img/default-food.png"}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-lg mr-4"
              />
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">{item.name}</h3>
                    <p className="text-green-600 font-medium">
                      {convertPrice(item.price).toLocaleString()} Fcfa
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 ml-2"
                    aria-label="Supprimer l'article"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>

                {item.selectedExtras && (
                  <div className="mt-2 pl-2 border-l-2 border-green-100">
                    {Object.entries(item.selectedExtras).map(
                      ([extraListId, indexes]) => {
                        const extraList = extraLists.find(
                          (el) => el.id === extraListId
                        );
                        return (
                          <div key={extraListId} className="mt-1">
                            <p className="text-sm font-medium text-gray-600">
                              {extraList?.name || "Options supplémentaires"} :
                            </p>
                            <ul className="list-disc list-inside">
                              {indexes.map((index) => {
                                const { name, price } = getExtraDetails(
                                  extraListId,
                                  index
                                );
                                return (
                                  <li
                                    key={`${extraListId}-${index}`}
                                    className="text-sm text-gray-500 ml-2"
                                  >
                                    {name}
                                    {price > 0 && (
                                      <span className="ml-1 text-green-500">
                                        (+{convertPrice(price).toLocaleString()} Fcfa)
                                      </span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}

                <div className="flex items-center mt-3">
                  <div className="flex items-center border rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity === 1}
                      className={`px-3 py-1 text-lg ${
                        item.quantity === 1
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-green-600 hover:bg-gray-50"
                      }`}
                    >
                      −
                    </button>
                    <span className="px-3 text-gray-700">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-3 py-1 text-green-600 hover:bg-gray-50 text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <footer className="fixed bottom-0 w-full bg-white border-t shadow-lg">
        <div className="p-3 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-gray-700">Total :</span>
            <span className="font-bold text-green-600 text-xl">
              {total.toLocaleString()} Fcfa
            </span>
          </div>
          <button
            onClick={handleCheckout}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
          >
            <i className="fas fa-check-circle mr-2"></i>
            Commander maintenant
          </button>
        </div>

        <nav className="grid grid-cols-4 text-center border-t">
          <Link
            to="/"
            className="py-2 text-gray-600 hover:text-green-600 transition-colors"
          >
            <i className="fas fa-home block text-xl mb-1"></i>
            <span className="text-xs">Boutique</span>
          </Link>
          <Link
            to="/cart"
            className="py-2 text-green-600 font-medium"
          >
            <i className="fas fa-shopping-cart block text-xl mb-1"></i>
            <span className="text-xs">Panier</span>
          </Link>
          <Link
            to="/orders"
            className="py-2 text-gray-600 hover:text-green-600 transition-colors"
          >
            <i className="fas fa-shopping-bag block text-xl mb-1"></i>
            <span className="text-xs">Commandes</span>
          </Link>
          <Link
            to="/account"
            className="py-2 text-gray-600 hover:text-green-600 transition-colors"
          >
            <i className="fas fa-user block text-xl mb-1"></i>
            <span className="text-xs">Compte</span>
          </Link>
        </nav>
      </footer>
    </div>
  );
};

export default CartPage;