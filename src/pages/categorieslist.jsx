import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useCart } from "../context/cartcontext";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const CategoryListing = () => {
  const { id: categoryId } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addMessage, setAddMessage] = useState("");
  const { addToCart } = useCart();

  const itemSliderSettings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, "items"),
          where("categoryId", "==", categoryId)
        );
        const querySnapshot = await getDocs(q);
        const itemsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setItems(itemsData);
      } catch (err) {
        setError("Erreur lors de la récupération des articles.");
      } finally {
        setLoading(false);
      }
    };

    if (categoryId) {
      fetchItems();
    }
  }, [categoryId]);

  const handleAddToCart = (item) => {
    addToCart(item);
    setAddMessage("Le plat a bien été ajouté au panier !");
    setTimeout(() => {
      setAddMessage("");
    }, 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-green-600 border-solid mb-4"></div>
        <p className="text-center text-gray-600">Chargement des plats...</p>
      </div>
    );
  }

  if (error) {
    return <p className="p-4 text-center text-red-600">{error}</p>;
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white border-b p-3">
        <div className="flex items-center">
          <Link to="/" className="text-green-600 font-bold flex items-center">
            <i className="fas fa-arrow-left mr-2"></i> Retour
          </Link>
          <h2 className="ml-4 text-xl font-bold">Plats de la catégorie</h2>
        </div>
      </header>

      {addMessage && (
        <div className="bg-green-100 text-green-700 p-2 text-center">
          {addMessage}
        </div>
      )}

      <div className="px-3 bg-white mt-2">
        {items.length === 0 ? (
          <p className="p-4 text-center text-gray-600">
            Aucun plat trouvé pour cette catégorie.
          </p>
        ) : (
          <div className="flex flex-col space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <Link to={`/detail/${item.id}`} className="no-underline text-black">
                  <div className="relative h-32"> {/* Réduire la hauteur ici */}
                    {item.discount && (
                      <span className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full bg-red-500 text-white">
                        {item.discount}% OFF
                      </span>
                    )}
                    {item.covers && item.covers.length > 0 ? (
                      item.covers.length === 1 ? (
                        <div className="flex items-center justify-center h-full">
                          <img
                            src={item.covers[0]}
                            alt={item.name}
                            className="w-full h-full object-cover" /* Conserver le ratio */
                          />
                        </div>
                      ) : (
                        <Slider {...itemSliderSettings}>
                          {item.covers.map((cover, index) => (
                            <div key={index} className="h-32"> {/* Réduire la hauteur ici */}
                              <img
                                src={cover}
                                alt={`${item.name} ${index + 1}`}
                                className="w-full h-full object-cover" /* Conserver le ratio */
                              />
                            </div>
                          ))}
                        </Slider>
                      )
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <img
                          src="/img/default.png"
                          alt={item.name}
                          className="w-full h-full object-cover" /* Conserver le ratio */
                        />
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-4">
                  <Link to={`/detail/${item.id}`} className="no-underline text-black">
                    <h6 className="font-medium text-lg">{item.name}</h6>
                  </Link>
                  <p className="text-gray-600 text-sm mt-1">{item.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-green-600 font-bold">{item.price} Fcfa</p>
                    <button
                      onClick={() => handleAddToCart(item)}
                      className="bg-green-600 text-white px-3 py-1 rounded-full text-sm hover:bg-green-700 transition-colors"
                    >
                      <i className="fas fa-plus"></i> Ajouter
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="fixed bottom-0 w-full bg-white border-t text-center">
        <div className="grid grid-cols-4">
          <Link to="/" className="text-black p-2">
            <p className="m-0">
              <i className="fas fa-store text-green-600"></i>
            </p>
            Boutique
          </Link>
          <Link to="/cart" className="text-gray-600 p-2">
            <p className="m-0">
              <i className="fas fa-shopping-cart"></i>
            </p>
            Panier
          </Link>
          <Link to="/complete_order" className="text-gray-600 p-2">
            <p className="m-0">
              <i className="fas fa-shopping-bag"></i>
            </p>
            Commandes
          </Link>
          <Link to="/my_account" className="text-gray-600 p-2">
            <p className="m-0">
              <i className="fas fa-user"></i>
            </p>
            Compte
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default CategoryListing;