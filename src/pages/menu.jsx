import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { useCart } from "../context/cartcontext"; // Importer le contexte du panier

// Header Component
const Header = ({ menu }) => (
  <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-30 border-b border-gray-100">
    <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
      <Link to="/" className="text-green-600 hover:text-green-700 p-1">
        <i className="fas fa-arrow-left text-lg"></i>
      </Link>
      <h1 className="text-base font-bold text-gray-900 truncate flex-1 text-center sm:text-lg sm:text-left sm:flex-initial sm:max-w-md">
        {menu.name}
      </h1>
      <div className="sm:hidden">
        <Link to="/cart" className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center">
          <i className="fas fa-shopping-basket text-sm"></i>
        </Link>
      </div>
      <div className="hidden sm:flex items-center space-x-2">
        <span className="bg-blue-50 px-2 py-0.5 rounded-full text-xs font-medium text-gray-700 flex items-center">
          <i className="fas fa-bolt text-blue-500 mr-1"></i> Livraison rapide
        </span>
      </div>
    </div>
  </header>
);

// Cover Image Component
const CoverImage = ({ menu, coverError, setCoverError }) => (
  <div className="mt-12 sm:mt-14 relative">
    {menu.covers?.length > 0 && !coverError ? (
      <div className="relative h-28 sm:h-40 md:h-56 w-full overflow-hidden">
        <img
          src={menu.covers[0]}
          alt={menu.name}
          className="w-full h-full object-cover sm:transition-transform sm:duration-500 sm:ease-out sm:hover:scale-105"
          onError={() => setCoverError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
      </div>
    ) : (
      <div className="w-full h-28 sm:h-40 md:h-56 bg-gray-200 flex items-center justify-center">
        <i className="fas fa-image text-2xl sm:text-3xl text-gray-400"></i>
      </div>
    )}
  </div>
);

// Category Navigation
const CategoryNav = ({ itemsByCategory, activeCategory, setActiveCategory }) => {
  const categoryNames = Object.keys(itemsByCategory);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-12 sm:top-14 bg-white z-20 shadow-sm py-1 sm:py-2 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="sm:hidden flex items-center justify-between">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-700 hover:text-green-600 flex items-center text-sm font-medium px-2 py-1"
          >
            <i className="fas fa-bars mr-1"></i> Catégories
          </button>
        </div>
        <div
          className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <ul className="flex flex-col space-y-1 py-2">
            {categoryNames.map((categoryName) => (
              <li key={categoryName}>
                <button
                  onClick={() => {
                    setActiveCategory(categoryName);
                    setIsOpen(false);
                    document
                      .getElementById(categoryName.replace(/\s+/g, "-"))
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                    activeCategory === categoryName
                      ? "bg-green-600 text-white rounded-md"
                      : "text-gray-700 hover:text-green-600 hover:bg-gray-100"
                  }`}
                >
                  {categoryName}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <ul className="hidden sm:flex space-x-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 snap-x snap-mandatory pb-1">
          {categoryNames.map((categoryName, index) => (
            <li
              key={categoryName}
              className="snap-start animate-[slide-in_0.4s_ease-out_forwards]"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <button
                onClick={() => {
                  setActiveCategory(categoryName);
                  document
                    .getElementById(categoryName.replace(/\s+/g, "-"))
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`px-3 py-1.5 text-sm font-medium transition-all duration-300 ${
                  activeCategory === categoryName
                    ? "bg-green-600 text-white rounded-full shadow-sm"
                    : "text-gray-700 hover:text-green-600 border-b-2 border-transparent hover:border-green-600"
                }`}
              >
                {categoryName}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

// Item Card Component avec ajout au panier
const ItemCard = ({ item, formatPrice, handleAddClick }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden sm:hover:shadow-md sm:transition-all sm:duration-300 animate-[fade-in_0.4s_ease-out_forwards]">
    <div className="relative aspect-square">
      {item.covers?.length > 0 ? (
        <img
          src={item.covers[0]}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => (e.target.style.display = "none")}
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <i className="fas fa-utensils text-xl sm:text-2xl text-gray-400"></i>
        </div>
      )}
      <button
        onClick={(e) => handleAddClick(item, e)}
        className="absolute bottom-2 right-2 bg-green-600 text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center hover:bg-green-700 transition-all duration-200"
      >
        <i className="fas fa-plus text-xs sm:text-sm"></i>
      </button>
    </div>
    <div className="p-2 sm:p-3">
      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{item.name}</h3>
      <p className="text-gray-600 text-xs sm:text-sm line-clamp-2 mt-0.5 sm:mt-1">
        {item.description || "Délicieuse préparation maison"}
      </p>
      <p className="text-green-700 font-bold text-xs sm:text-sm mt-1 sm:mt-2">{formatPrice(item)}</p>
    </div>
  </div>
);

// Category Section
const CategorySection = ({ categoryName, categoryItems, formatPrice, isFirst, isActive, handleAddClick }) => (
  <section
    id={categoryName.replace(/\s+/g, "-")}
    className={`py-3 sm:py-6 ${isFirst ? "pt-2 sm:pt-3" : ""} transition-all duration-300 ease-out ${
      isActive ? "opacity-100 translate-y-0" : "opacity-70 translate-y-2"
    }`}
  >
    <div className="max-w-7xl mx-auto px-3 sm:px-4">
      <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-4 flex items-center animate-[fade-in_0.4s_ease-out_forwards]">
        <span className="truncate">{categoryName}</span>
        <span className="text-xs text-gray-500 font-normal ml-1 sm:ml-2">({categoryItems.length})</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {categoryItems.map((item) => (
          <ItemCard key={item.id} item={item} formatPrice={formatPrice} handleAddClick={handleAddClick} />
        ))}
      </div>
    </div>
  </section>
);

const MenuDisplayPage = () => {
  const { menuId } = useParams();
  const [menu, setMenu] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [coverError, setCoverError] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [successMessage, setSuccessMessage] = useState(""); // État pour le message de succès
  const { addToCart, cartItems } = useCart(); // Utilisation du contexte du panier

  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        setLoading(true);
        setError(null);

        const menuDocRef = doc(db, "menus", menuId);
        const menuSnapshot = await getDoc(menuDocRef);
        if (!menuSnapshot.exists()) throw new Error("Menu non trouvé");
        setMenu({ id: menuSnapshot.id, ...menuSnapshot.data() });

        const itemsQuery = query(collection(db, "items"), where("menuId", "==", menuId));
        const itemsSnapshot = await getDocs(itemsQuery);
        const itemsData = itemsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setItems(itemsData);

        const categoriesSnapshot = await getDocs(collection(db, "categories"));
        const categoriesData = categoriesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCategories(categoriesData);
      } catch (err) {
        console.error("Erreur lors de la récupération des données :", err);
        setError(err.message || "Erreur lors du chargement du menu");
      } finally {
        setLoading(false);
      }
    };

    fetchMenuData();
  }, [menuId]);

  const formatPrice = (item) => {
    if (item.price) return `${Number(item.price).toLocaleString("fr-FR")} FCFA`;
    if (item.sizes) {
      return Object.entries(item.sizes)
        .map(([size, price]) => `${size}: ${Number(price).toLocaleString("fr-FR")} FCFA`)
        .join(" • ");
    }
    return "Prix sur demande";
  };

  const itemsByCategory = useMemo(() => {
    const grouped = items.reduce((acc, item) => {
      const category = categories.find((cat) => cat.id === item.categoryId);
      const categoryName = category ? category.name : "Autres";
      if (!acc[categoryName]) acc[categoryName] = [];
      acc[categoryName].push(item);
      return acc;
    }, {});

    const preferredOrder = ["Entrées", "Plats principaux", "Desserts", "Boissons"];
    const sortedCategories = {};
    preferredOrder.forEach((cat) => {
      if (grouped[cat]) {
        sortedCategories[cat] = grouped[cat];
        delete grouped[cat];
      }
    });

    return { ...sortedCategories, ...grouped };
  }, [items, categories]);

  useEffect(() => {
    if (Object.keys(itemsByCategory).length > 0 && !activeCategory) {
      setActiveCategory(Object.keys(itemsByCategory)[0]);
    }
  }, [itemsByCategory, activeCategory]);

  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  const handleScroll = useCallback(
    debounce(() => {
      const categoryElements = Object.keys(itemsByCategory).map((categoryName) => ({
        id: categoryName.replace(/\s+/g, "-"),
        element: document.getElementById(categoryName.replace(/\s+/g, "-")),
      }));

      for (const { id, element } of categoryElements) {
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveCategory(id.replace(/-/g, " "));
            break;
          }
        }
      }
    }, 100),
    [itemsByCategory]
  );

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Fonction pour ajouter au panier
  const handleAddClick = (item, e) => {
    e.preventDefault();
    addToCart({ ...item, restaurantId: item.restaurantId || "default_restaurant_id" });
    setSuccessMessage(`${item.name} ajouté au panier !`);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-3 border-b-3 border-green-600 mb-2"></div>
        <p className="text-gray-600 text-xs">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-3">
        <i className="fas fa-exclamation-circle text-red-500 text-2xl mb-2"></i>
        <h2 className="text-base font-bold text-gray-800 mb-1">Erreur</h2>
        <p className="text-gray-600 text-center max-w-xs text-xs mb-3">{error}</p>
        <Link
          to="/"
          className="bg-green-600 text-white px-3 py-1.5 rounded-full hover:bg-green-700 transition-colors duration-300 text-xs"
        >
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Message de succès */}
      {successMessage && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-bounce">
          {successMessage}
        </div>
      )}

      <Header menu={menu} />
      <CoverImage menu={menu} coverError={coverError} setCoverError={setCoverError} />

      {Object.keys(itemsByCategory).length > 0 && (
        <>
          <CategoryNav
            itemsByCategory={itemsByCategory}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />
          <main className="pb-12 sm:pb-16">
            {Object.entries(itemsByCategory).map(([categoryName, categoryItems], index) => (
              <CategorySection
                key={categoryName}
                categoryName={categoryName}
                categoryItems={categoryItems}
                formatPrice={formatPrice}
                isFirst={index === 0}
                isActive={activeCategory === categoryName}
                handleAddClick={handleAddClick} // Passer la fonction au composant
              />
            ))}
          </main>
        </>
      )}

      {/* Bouton panier fixe pour desktop avec redirection */}
      <div className="hidden sm:block fixed bottom-3 right-3 z-10">
        <Link
          to="/cart"
          className="bg-green-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:bg-green-700 transition-transform duration-300 hover:scale-105 relative"
        >
          <i className="fas fa-shopping-basket text-base"></i>
          {cartItems.length > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-600 rounded-full">
              {cartItems.length}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
};

// CSS Animations et Scrollbar
const styles = `
  @keyframes slide-in {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-[slide-in_0.4s_ease-out_forwards] {
    animation: slide-in 0.4s ease-out forwards;
  }
  .animate-[fade-in_0.4s_ease-out_forwards] {
    animation: fade-in 0.4s ease-out forwards;
  }
  .scrollbar-thin::-webkit-scrollbar {
    height: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: #f3f4f6;
  }
`;

if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default MenuDisplayPage;