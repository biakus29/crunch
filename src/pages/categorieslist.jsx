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
  const [extraLists, setExtraLists] = useState([]); // Ajout pour les extras
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addMessage, setAddMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState(null); // Pour la modale
  const [selectedExtras, setSelectedExtras] = useState({}); // Extras sélectionnés
  const { addToCart } = useCart();

  const itemSliderSettings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Récupérer les articles
        const itemsQuery = query(
          collection(db, "items"),
          where("categoryId", "==", categoryId)
        );
        const itemsSnapshot = await getDocs(itemsQuery);
        const itemsData = itemsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setItems(itemsData);

        // Récupérer les extraLists
        const extraListsSnapshot = await getDocs(collection(db, "extraLists"));
        const extraListsData = extraListsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setExtraLists(extraListsData);
      } catch (err) {
        setError("Erreur lors de la récupération des données.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (categoryId) {
      fetchData();
    }
  }, [categoryId]);

  const convertPrice = (price) => {
    if (typeof price === "string") {
      return parseFloat(price.replace(/\./g, ""));
    }
    return Number(price);
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
    let total = selectedItem ? convertPrice(selectedItem.price) : 0;
    if (isNaN(total)) total = 0;
    Object.entries(selectedExtras).forEach(([assortmentId, indexes]) => {
      const extraList = extraLists.find((el) => el.id === assortmentId);
      if (extraList) {
        indexes.forEach((index) => {
          const extra = extraList.extraListElements?.[index];
          if (extra && extra.price) {
            const extraPrice = convertPrice(extra.price);
            total += isNaN(extraPrice) ? 0 : extraPrice;
          }
        });
      }
    });
    return total;
  };

  const handleAddClick = (item) => {
    if (item.assortments?.length > 0) {
      setSelectedItem(item);
      setSelectedExtras({});
    } else {
      addToCart({ ...item, restaurantId: item.restaurantId || "default_restaurant_id" });
      setAddMessage(`${item.name} a bien été ajouté au panier !`);
      setTimeout(() => setAddMessage(""), 2000);
    }
  };

  const handleAddToCart = () => {
    if (validateExtras()) {
      addToCart({
        ...selectedItem,
        restaurantId: selectedItem.restaurantId || "default_restaurant_id",
        selectedExtras,
      });
      setAddMessage(`${selectedItem.name} a bien été ajouté au panier !`);
      setTimeout(() => setAddMessage(""), 2000);
      setSelectedItem(null);
      setSelectedExtras({});
    }
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
                  <div className="relative h-32">
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
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <Slider {...itemSliderSettings}>
                          {item.covers.map((cover, index) => (
                            <div key={index} className="h-32">
                              <img
                                src={cover}
                                alt={`${item.name} ${index + 1}`}
                                className="w-full h-full object-cover"
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
                          className="w-full h-full object-cover"
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
                    <p className="text-green-600 font-bold">
                      {convertPrice(item.price).toLocaleString()} Fcfa
                    </p>
                    <button
                      onClick={() => handleAddClick(item)}
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
                  onClick={handleAddToCart}
                  disabled={!validateExtras()}
                  className={`px-4 py-2 rounded-lg flex-1 ${
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