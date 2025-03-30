import React, { useEffect, useState } from 'react';
import Slider from 'react-slick';
import { Link } from 'react-router-dom';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useCart } from '../context/cartcontext';
import logo from '../image/logo.png';
import '@fortawesome/fontawesome-free/css/all.min.css';

const HomePage = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [promos, setPromos] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState({});
  const { addToCart, cartItems } = useCart();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesSnap, itemsSnap, promosSnap, extraListsSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'items')),
        getDocs(collection(db, 'promos')),
        getDocs(collection(db, 'extraLists'))
      ]);

      setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setItems(itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setPromos(promosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setExtraLists(extraListsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setError('Erreur de chargement des données');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const promoSliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
  };

  const itemSliderSettings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  const handleAddClick = (item, e) => {
    e.preventDefault();
    if (item.assortments?.length > 0) {
      setSelectedItem(item);
      setSelectedExtras({});
    } else {
      addToCart({ ...item, restaurantId: item.restaurantId || "default_restaurant_id" });
      setSuccessMessage(`${item.name} ajouté au panier !`);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const validateExtras = () => {
    if (!selectedItem) return false;
    return selectedItem.assortments.every(assortmentId => {
      const extraList = extraLists.find(el => el.id === assortmentId);
      const requiredElements = extraList?.extraListElements?.filter(el => el.required) || [];
      if (requiredElements.length === 0) return true;
      const selected = selectedExtras[assortmentId] || [];
      return selected.length > 0;
    });
  };

  const getCurrentDay = () => {
    const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    return days[new Date().getDay()];
  };

  const convertPrice = (price) => {
    if (typeof price === 'string') {
      return parseFloat(price.replace(/\./g, ''));
    }
    return Number(price);
  };

  const calculateTotalPrice = () => {
    let total = selectedItem ? convertPrice(selectedItem.price) : 0;
    if (isNaN(total)) total = 0;
    Object.entries(selectedExtras).forEach(([assortmentId, indexes]) => {
      const extraList = extraLists.find(el => el.id === assortmentId);
      if (extraList) {
        indexes.forEach(index => {
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

  const handleAddToCart = () => {
    if (validateExtras()) {
      addToCart({
        ...selectedItem,
        restaurantId: selectedItem.restaurantId || "default_restaurant_id",
        selectedExtras
      });
      setSuccessMessage(`${selectedItem.name} ajouté au panier !`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setSelectedItem(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <i className="fas fa-spinner fa-spin text-4xl text-green-600"></i>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center bg-red-100 text-red-600">
        {error} - <button onClick={fetchData} className="text-red-600 underline">Réessayer</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {successMessage && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg z-50">
          {successMessage}
        </div>
      )}

      <header className="bg-white border-b p-3">
        <div className="flex items-center">
          <Link to="/" className="flex items-center no-underline text-black">
            <img src={logo} alt="logo" className="h-8 mr-2" />
            <h4 className="font-bold text-green-600 m-0">MANGE d'ABORD</h4>
          </Link>
          <div className="ml-auto flex items-center">
            <Link
              to="/notification"
              className="bg-white p-1 rounded shadow-sm flex items-center no-underline"
            >
              <i className="fas fa-bell text-lg text-gray-700"></i>
              <span className="bg-red-600 text-white text-xs px-1 rounded-full ml-1">
                2
              </span>
            </Link>
            <Link to="#" className="ml-3 text-gray-700">
              <i className="fas fa-bars text-xl"></i>
            </Link>
          </div>
        </div>
        <Link to="/search" className="no-underline">
          <div className="mt-3 rounded shadow-sm overflow-hidden bg-white flex">
            <button className="bg-white p-2 border-0 text-green-600">
              <i className="fas fa-search"></i>
            </button>
            <input
              type="text"
              className="flex-1 p-2 border-0"
              placeholder="Rechercher des produits..."
            />
          </div>
        </Link>
      </header>

      <section className="p-3">
        <h6 className="mb-2 font-medium">Que recherchez-vous ?</h6>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((category) => (
            <div key={category.id} className="bg-white shadow-sm rounded text-center p-2">
              <Link to={`/category/${category.id}`}>
                <img
                  src={category.icon}
                  alt={category.name}
                  className="w-10 h-10 mx-auto"
                />
                <p className="mt-2 text-sm text-gray-600">{category.name}</p>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="py-3 bg-white shadow-sm">
        <div className="flex items-center px-3 mb-2">
          <h6 className="m-0 font-medium">Promotions</h6>
          <Link to="/promos" className="ml-auto text-green-600">
            Voir plus
          </Link>
        </div>
        {promos.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <i className="fas fa-info-circle text-2xl"></i>
            <p>Aucune promotion disponible</p>
          </div>
        ) : (
          <Slider {...promoSliderSettings}>
            {promos.map((promo) => (
              <div key={promo.id}>
                <img 
                  src={promo.image || '/img/default.png'} 
                  alt={promo.name} 
                  className="w-full h-48 object-cover rounded"
                />
                <div className="p-3 bg-green-50">
                  <h4 className="text-green-600">{promo.title}</h4>
                  <p className="text-sm text-gray-600">{promo.description}</p>
                </div>
              </div>
            ))}
          </Slider>
        )}
      </section>

      <section className="px-3">
        <div className="flex items-center mt-4 mb-2">
          <h6 className="m-0 font-medium">Sélection du jour</h6>
          <Link to="/picks_today" className="ml-auto text-green-600">
            Voir plus
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items
            .filter(item => item.scheduledDay?.includes(getCurrentDay()))
            .map((item) => (
              <div key={item.id} className="bg-white rounded shadow-sm overflow-hidden relative">
                <Link to={`/detail/${item.id}`} className="no-underline text-black">
                  <div className="relative">
                    {item.covers?.length > 0 ? (
                      <Slider {...itemSliderSettings}>
                        {item.covers.map((cover, index) => (
                          <div key={index}>
                            <img 
                              src={cover} 
                              alt={`${item.name} ${index + 1}`} 
                              className="w-full h-32 object-cover"
                            />
                          </div>
                        ))}
                      </Slider>
                    ) : (
                      <img 
                        src="/img/default.png" 
                        alt={item.name} 
                        className="w-full h-32 object-cover"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <h6 className="font-medium">{item.name}</h6>
                    <div className="flex items-center justify-between">
                      <h6 className="text-green-600">{convertPrice(item.price).toLocaleString()} Fcfa</h6>
                    </div>
                  </div>
                </Link>
                <button 
                  onClick={(e) => handleAddClick(item, e)}
                  className="bg-green-600 text-white px-2 py-1 rounded-full text-sm absolute bottom-2 right-2 hover:bg-green-700"
                >
                  +
                </button>
              </div>
            ))}
        </div>
      </section>

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
              {selectedItem.assortments.map(assortmentId => {
                const extraList = extraLists.find(el => el.id === assortmentId);
                if (!extraList) return null;

                return (
                  <div key={extraList.id} className="mb-6">
                    <h4 className="font-medium mb-3 text-gray-700">
                      {extraList.name}
                      {extraList.extraListElements?.some(el => el.required) && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </h4>
                    
                    <div className="space-y-2">
                      {extraList.extraListElements?.map((el, index) => (
                        <label 
                          key={index}
                          className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                            selectedExtras[assortmentId]?.includes(index)
                              ? 'bg-green-50 border-2 border-green-200'
                              : 'border border-gray-200 hover:border-green-200'
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
                                [assortmentId]: newSelection
                              });
                            }}
                            className="form-checkbox h-5 w-5 text-green-600 focus:ring-green-500"
                          />
                          <div className="ml-3 flex-1">
                            <span className="text-gray-700">{el.name}</span>
                            {el.price && (
                              <span className="text-sm text-gray-500 ml-2">+ {convertPrice(el.price).toLocaleString()} FCFA</span>
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
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
          <Link to="/" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
            <i className="fas fa-home text-lg"></i>
            <span className="block text-xs mt-1">Accueil</span>
          </Link>
          
          <Link to="/cart" className="relative text-gray-700 p-2 hover:text-green-600 transition-colors">
            <i className="fas fa-shopping-cart text-lg"></i>
            {cartItems.length > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-green-600 rounded-full">
                {cartItems.length}
              </span>
            )}
            <span className="block text-xs mt-1">Panier</span>
          </Link>
          
          <Link to="/orders" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
            <i className="fas fa-shopping-bag text-lg"></i>
            <span className="block text-xs mt-1">Commandes</span>
          </Link>
          
          <Link to="/account" className="text-gray-700 p-2 hover:text-green-600 transition-colors">
            <i className="fas fa-user text-lg"></i>
            <span className="block text-xs mt-1">Compte</span>
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;