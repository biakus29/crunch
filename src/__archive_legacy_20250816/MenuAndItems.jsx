import React, { useState, useEffect, useCallback, useMemo } from "react";
import { db, auth, storage } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { formatPrice } from "../utils/orderUtils";

const MenuAndItems = () => {
  const [restaurant, setRestaurant] = useState(null);
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [extraLists, setExtraLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);
  const [editingMenu, setEditingMenu] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [menuData, setMenuData] = useState({ name: "", covers: [], coverPreviews: [] });
  const [categoryData, setCategoryData] = useState({
    name: "",
    description: "",
    icon: "",
    iconFile: null,
    iconPreview: "",
  });
  const [itemData, setItemData] = useState({
    name: "",
    description: "",
    priceType: "single",
    price: "",
    sizes: { L: "", XL: "" },
    saleMode: "pack",
    categoryId: "",
    available: true,
    scheduledDay: [],
    needAssortement: false,
    assortments: [],
    extraLists: [],
    quantityleft: 0,
    covers: [],
    coverPreviews: [],
    menuId: "",
  });
  const [extraListData, setExtraListData] = useState({
    name: "",
    extraListElements: [{ name: "", price: "", required: false, multiple: false }],
  });
  const daysOfWeek = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "restaurants"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const restaurantDoc = querySnapshot.docs[0];
          setCurrentRestaurantId(restaurantDoc.id);
          setRestaurant({ id: restaurantDoc.id, ...restaurantDoc.data() });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentRestaurantId) return;
    const fetchStaticData = async () => {
      try {
        const [menusSnap, categoriesSnap, itemsSnap, extraListsSnap] = await Promise.all([
          getDocs(query(collection(db, "menus"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(query(collection(db, "categories"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(query(collection(db, "items"), where("restaurantId", "==", currentRestaurantId))),
          getDocs(query(collection(db, "extraLists"), where("restaurantId", "==", currentRestaurantId))),
        ]);
        setMenus(menusSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setCategories(categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setItems(itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setExtraLists(extraListsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Erreur lors de la récupération des données statiques:", err);
        setError("Erreur lors du chargement des données statiques");
      }
    };
    fetchStaticData();
  }, [currentRestaurantId]);

  const uploadImages = useCallback(async (files) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;
    const validFiles = files.filter(file => allowedTypes.includes(file.type) && file.size <= maxSize);
    if (validFiles.length !== files.length) {
      setError("Certains fichiers sont invalides (type ou taille > 5MB).");
    }
    const urls = await Promise.all(
      validFiles.map(async (file) => {
        const fileRef = ref(storage, `menus/${uuidv4()}_${file.name}`);
        await uploadBytes(fileRef, file);
        return getDownloadURL(fileRef);
      })
    );
    return urls;
  }, []);

  const resetItemForm = () => {
    setItemData({
      name: "",
      description: "",
      priceType: "single",
      price: "",
      sizes: { L: "", XL: "" },
      saleMode: "pack",
      categoryId: "",
      available: true,
      scheduledDay: [],
      needAssortement: false,
      assortments: [],
      extraLists: [],
      quantityleft: 0,
      covers: [],
      coverPreviews: [],
      menuId: "",
    });
    setEditingItem(null);
  };

  const addMenu = async () => {
    if (!menuData.name) {
      setError("Le nom du menu est requis.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const uploadedCovers = menuData.covers.length > 0 ? await uploadImages(menuData.covers) : [];
      const newMenu = { 
        name: menuData.name, 
        restaurantId: currentRestaurantId, 
        covers: uploadedCovers,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "menus"), newMenu);
      setMenus([...menus, { id: docRef.id, ...newMenu }]);
      setMenuData({ name: "", covers: [], coverPreviews: [] });
    } catch (error) {
      console.error("Erreur lors de la création du menu:", error);
      setError("Erreur lors de la création du menu : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateMenu = async () => {
    if (!editingMenu || !menuData.name) {
      setError("Le nom du menu est requis pour la mise à jour.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const newCovers = menuData.covers.filter(file => file instanceof File);
      const existingCovers = menuData.covers.filter(url => typeof url === "string");
      const uploadedCovers = newCovers.length > 0 ? await uploadImages(newCovers) : [];
      const updatedCovers = [...existingCovers, ...uploadedCovers];
      const updatedData = { 
        name: menuData.name, 
        covers: updatedCovers,
        updatedAt: Timestamp.now(),
      };
      await updateDoc(doc(db, "menus", editingMenu.id), updatedData);
      setMenus(menus.map((menu) => 
        menu.id === editingMenu.id ? { ...menu, ...updatedData } : menu
      ));
      setEditingMenu(null);
      setMenuData({ name: "", covers: [], coverPreviews: [] });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du menu:", error);
      setError("Erreur lors de la mise à jour du menu : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditingMenu = (menu) => {
    setEditingMenu(menu);
    setMenuData({
      name: menu.name,
      covers: menu.covers || [],
      coverPreviews: menu.covers || [],
    });
  };

  const deleteMenu = async (menuId) => {
    try {
      await deleteDoc(doc(db, "menus", menuId));
      setMenus(menus.filter((menu) => menu.id !== menuId));
    } catch (error) {
      console.error("Erreur lors de la suppression du menu:", error);
      setError("Erreur lors de la suppression du menu");
    }
  };

  const addCategory = async () => {
    if (!categoryData.name) {
      setError("Le nom de la catégorie est requis.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      let iconUrl = "";
      if (categoryData.iconFile) {
        const uploadedUrls = await uploadImages([categoryData.iconFile]);
        iconUrl = uploadedUrls[0] || "";
      } else {
        iconUrl = categoryData.icon || "";
      }
      const newCategory = {
        name: categoryData.name,
        description: categoryData.description || "",
        icon: iconUrl,
        restaurantId: currentRestaurantId,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "categories"), newCategory);
      setCategories([...categories, { id: docRef.id, ...newCategory }]);
      setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
    } catch (error) {
      console.error("Erreur lors de la création de la catégorie:", error);
      setError("Erreur lors de la création de la catégorie : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async () => {
    if (!editingCategory || !categoryData.name) {
      setError("Le nom de la catégorie est requis.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      let iconUrl = "";
      if (categoryData.iconFile) {
        const uploadedUrls = await uploadImages([categoryData.iconFile]);
        iconUrl = uploadedUrls[0] || "";
      } else {
        iconUrl = categoryData.icon || "";
      }
      const updatedData = {
        name: categoryData.name,
        description: categoryData.description || "",
        icon: iconUrl,
        updatedAt: Timestamp.now(),
      };
      await updateDoc(doc(db, "categories", editingCategory.id), updatedData);
      setCategories(
        categories.map((category) =>
          category.id === editingCategory.id ? { ...category, ...updatedData } : category
        )
      );
      setEditingCategory(null);
      setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la catégorie:", error);
      setError("Erreur lors de la mise à jour de la catégorie : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditingCategory = (category) => {
    setEditingCategory(category);
    setCategoryData({
      name: category.name,
      description: category.description,
      icon: category.icon || "",
      iconFile: null,
      iconPreview: category.icon || "",
    });
  };

  const deleteCategory = async (categoryId) => {
    try {
      await deleteDoc(doc(db, "categories", categoryId));
      setCategories(categories.filter((category) => category.id !== categoryId));
    } catch (error) {
      console.error("Erreur lors de la suppression de la catégorie:", error);
      setError("Erreur lors de la suppression de la catégorie");
    }
  };

  const addItem = async () => {
    if (!itemData.name || !itemData.categoryId || !itemData.menuId) {
      setError("Tous les champs obligatoires doivent être remplis.");
      return;
    }
    if (itemData.priceType === "single" && !itemData.price) {
      setError("Le prix est requis.");
      return;
    }
    if (itemData.priceType === "sizes" && (!itemData.sizes.L || !itemData.sizes.XL)) {
      setError("Les prix pour L et XL sont requis.");
      return;
    }
    try {
      const uploadedCovers = await uploadImages(itemData.covers);
      if (itemData.covers.length > 0 && uploadedCovers.length === 0) {
        setError("Échec du téléchargement des images");
        return;
      }
      const priceValue = itemData.priceType === "single" 
        ? Number(itemData.price.replace(/\./g, "")) 
        : Math.min(Number(itemData.sizes.L.replace(/\./g, "")), Number(itemData.sizes.XL.replace(/\./g, "")));
      if (isNaN(priceValue)) {
        setError("Prix invalide");
        return;
      }
      const newItem = {
        ...itemData,
        covers: uploadedCovers,
        restaurantId: currentRestaurantId,
        ...(itemData.priceType === "single" ? { price: itemData.price } : { sizes: itemData.sizes }),
      };
      const docRef = await addDoc(collection(db, "items"), newItem);
      setItems([...items, { id: docRef.id, ...newItem }]);
      await updateDoc(doc(db, "menus", itemData.menuId), { items: arrayUnion(docRef.id) });
      resetItemForm();
    } catch (error) {
      console.error("Erreur lors de l'ajout du plat:", error);
      setError("Erreur lors de l'ajout du plat : " + error.message);
    }
  };

  const updateItem = async (itemId, newData) => {
    try {
      const uploadedCovers = newData.covers.some(file => file instanceof File)
        ? await uploadImages(newData.covers.filter(file => file instanceof File))
        : [];
      const updatedCovers = [
        ...(newData.covers.filter(url => typeof url === "string")),
        ...uploadedCovers,
      ];
      const priceValue = newData.priceType === "single" 
        ? Number(newData.price.replace(/\./g, "")) 
        : Math.min(Number(newData.sizes.L.replace(/\./g, "")), Number(newData.sizes.XL.replace(/\./g, "")));
      const updatedData = {
        ...newData,
        covers: updatedCovers,
        ...(newData.priceType === "single" ? { price: newData.price } : { sizes: newData.sizes }),
      };
      await updateDoc(doc(db, "items", itemId), updatedData);
      setItems(items.map((item) => (item.id === itemId ? { ...item, ...updatedData } : item)));
      resetItemForm();
    } catch (error) {
      console.error("Erreur lors de la mise à jour du plat:", error);
      setError("Erreur lors de la mise à jour du plat");
    }
  };

  const startEditing = (item) => {
    setEditingItem(item);
    setItemData({
      name: item.name || "",
      description: item.description || "",
      priceType: item.price ? "single" : "sizes",
      price: item.price ? String(item.price) : "",
      sizes: item.sizes
        ? { L: String(item.sizes.L), XL: String(item.sizes.XL) }
        : { L: "", XL: "" },
      saleMode: item.saleMode || "pack",
      categoryId: item.categoryId || "",
      available: item.available !== undefined ? item.available : true,
      scheduledDay: Array.isArray(item.scheduledDay) ? item.scheduledDay : [],
      needAssortement: item.needAssortement !== undefined ? item.needAssortement : false,
      assortments: Array.isArray(item.assortments) ? item.assortments : [],
      extraLists: Array.isArray(item.extraLists) ? item.extraLists : [],
      quantityleft: item.quantityleft !== undefined ? Number(item.quantityleft) : 0,
      covers: Array.isArray(item.covers) ? item.covers : [],
      coverPreviews: Array.isArray(item.covers) ? item.covers : [],
      menuId: item.menuId || "",
    });
  };

  const deleteItem = async (itemId) => {
    try {
      await deleteDoc(doc(db, "items", itemId));
      setItems(items.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error("Erreur lors de la suppression du plat:", error);
      setError("Erreur lors de la suppression du plat");
    }
  };

  const addExtraList = async () => {
    if (!extraListData.name) return;
    try {
      const newExtraList = { ...extraListData, restaurantId: currentRestaurantId };
      const docRef = await addDoc(collection(db, "extraLists"), newExtraList);
      setExtraLists([...extraLists, { id: docRef.id, ...newExtraList }]);
      setExtraListData({
        name: "",
        extraListElements: [{ name: "", price: "", required: false, multiple: false }],
      });
    } catch (error) {
      console.error("Erreur lors de la création de l'extra list:", error);
      setError("Erreur lors de la création de l'extra list");
    }
  };

  const deleteExtraList = async (extraListId) => {
    try {
      await deleteDoc(doc(db, "extraLists", extraListId));
      setExtraLists(extraLists.filter((ex) => ex.id !== extraListId));
    } catch (error) {
      console.error("Erreur lors de la suppression de l'extra list:", error);
      setError("Erreur lors de la suppression de l'extra list");
    }
  };

  const handleDaySelection = (day) => {
    setItemData({
      ...itemData,
      scheduledDay: itemData.scheduledDay.includes(day)
        ? itemData.scheduledDay.filter((d) => d !== day)
        : [...itemData.scheduledDay, day],
    });
  };

  const addExtraElement = () => {
    setExtraListData({
      ...extraListData,
      extraListElements: [
        ...extraListData.extraListElements,
        { name: "", price: "", required: false, multiple: false },
      ],
    });
  };

  const updateExtraElement = (index, field, value) => {
    const newElements = extraListData.extraListElements.map((el, i) => {
      if (i !== index) return el;
      const updatedElement = { ...el, [field]: value };
      if (field === "required" && value) updatedElement.multiple = false;
      if (field === "multiple" && value) updatedElement.required = false;
      return updatedElement;
    });
    setExtraListData({ ...extraListData, extraListElements: newElements });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg p-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Tableau de bord</h2>
        <nav className="space-y-2">
          <a href="/restaurant-info" className="block p-2 hover:bg-gray-200 rounded-lg">Infos Restaurant</a>
          <a href="/menu-items" className="block p-2 bg-green-600 text-white rounded-lg">Menus & Plats</a>
          <a href="/orders-feedback" className="block p-2 hover:bg-gray-200 rounded-lg">Commandes & Feedback</a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Gestion des Menus, Plats, Catégories et Extras</h2>
        {loading && (
          <div className="text-center p-4">
            <div
              className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"
              role="status"
            >
              <span className="sr-only">Chargement...</span>
            </div>
          </div>
        )}
        {error && (
          <p className="text-center text-red-600 p-4" role="alert">
            {error}
          </p>
        )}
        {!loading && (
          <div className="space-y-6">
            {/* Menus */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                {editingMenu ? "Modifier le Menu" : "Créer un Menu"}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom du menu *</label>
                  <input
                    type="text"
                    placeholder="Nom du menu"
                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      !menuData.name && error ? "border-red-500" : ""
                    }`}
                    value={menuData.name}
                    onChange={(e) => setMenuData({ ...menuData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Images du menu</label>
                  <input
                    type="file"
                    multiple
                    className="w-full p-2 border rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      const previews = files.map(file => URL.createObjectURL(file));
                      setMenuData({ 
                        ...menuData, 
                        covers: editingMenu ? [...menuData.covers, ...files] : files,
                        coverPreviews: editingMenu ? [...menuData.coverPreviews, ...previews] : previews 
                      });
                    }}
                  />
                </div>
                {menuData.coverPreviews.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Prévisualisation</label>
                    <div className="flex flex-wrap gap-2">
                      {menuData.coverPreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Prévisualisation ${index + 1}`}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                          <button
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                            onClick={() => {
                              const newCovers = menuData.covers.filter((_, i) => i !== index);
                              const newPreviews = menuData.coverPreviews.filter((_, i) => i !== index);
                              setMenuData({ ...menuData, covers: newCovers, coverPreviews: newPreviews });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-4">
                <button
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                  onClick={editingMenu ? updateMenu : addMenu}
                  disabled={loading}
                >
                  {loading ? "Chargement..." : editingMenu ? "Mettre à jour" : "Créer Menu"}
                </button>
                {editingMenu && (
                  <button
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    onClick={() => {
                      setEditingMenu(null);
                      setMenuData({ name: "", covers: [], coverPreviews: [] });
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>

            {/* Liste des Menus */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Liste des Menus</h3>
              {menus.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucun menu ajouté pour le moment</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {menus.map((menu) => (
                    <div
                      key={menu.id}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                    >
                      <div className="flex items-start space-x-4">
                        {menu.covers?.length > 0 ? (
                          <div className="relative w-24 h-24">
                            <img
                              src={menu.covers[0]}
                              alt={menu.name}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => (e.target.src = "/img/default.png")}
                            />
                            {menu.covers.length > 1 && (
                              <span className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs rounded-full px-2 py-1">
                                +{menu.covers.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-gray-500 text-sm">Aucune image</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{menu.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">ID Restaurant: {menu.restaurantId}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-between">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          onClick={() => startEditingMenu(menu)}
                        >
                          Modifier
                        </button>
                        <button
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                          onClick={() => deleteMenu(menu.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Catégories */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                {editingCategory ? "Modifier la catégorie" : "Créer une nouvelle catégorie"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la catégorie *</label>
                  <input
                    type="text"
                    placeholder="Entrez le nom de la catégorie"
                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      !categoryData.name && error ? "border-red-500" : ""
                    }`}
                    value={categoryData.name}
                    onChange={(e) => setCategoryData({ ...categoryData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    placeholder="Décrivez la catégorie..."
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-y"
                    rows="3"
                    value={categoryData.description}
                    onChange={(e) => setCategoryData({ ...categoryData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icône</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="w-full p-2 border rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      setCategoryData({
                        ...categoryData,
                        iconFile: file,
                        iconPreview: file ? URL.createObjectURL(file) : categoryData.icon,
                      });
                    }}
                  />
                </div>
                {categoryData.iconPreview && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prévisualisation de l'icône</label>
                    <div className="relative">
                      <img
                        src={categoryData.iconPreview}
                        alt="Prévisualisation de l'icône"
                        className="w-24 h-24 object-cover rounded-lg"
                        onError={(e) => (e.target.src = "/img/default.png")}
                      />
                      <button
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        onClick={() =>
                          setCategoryData({ ...categoryData, iconFile: null, iconPreview: "", icon: "" })
                        }
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex gap-4">
                <button
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                  onClick={editingCategory ? updateCategory : addCategory}
                  disabled={loading || !categoryData.name}
                >
                  {loading ? "Chargement..." : editingCategory ? "Mettre à jour" : "Créer catégorie"}
                </button>
                {editingCategory && (
                  <button
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>

            {/* Liste des Catégories */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Liste des catégories</h3>
              {categories.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucune catégorie ajoutée pour le moment</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                    >
                      <div className="flex items-start space-x-4">
                        {category.icon ? (
                          <img
                            src={category.icon}
                            alt={category.name}
                            className="w-24 h-24 object-cover rounded-lg"
                            onError={(e) => (e.target.src = "/img/default.png")}
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-gray-500 text-sm">Aucune icône</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{category.name}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{category.description || "Aucune description"}</p>
                          <p className="text-xs text-gray-500 mt-1">ID Restaurant: {category.restaurantId}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-between">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          onClick={() => startEditingCategory(category)}
                        >
                          Modifier
                        </button>
                        <button
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                          onClick={() => {
                            if (window.confirm("Voulez-vous vraiment supprimer cette catégorie ?")) {
                              deleteCategory(category.id);
                            }
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Plats */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                {editingItem ? "Modifier le plat" : "Ajouter un nouveau plat"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom du plat *</label>
                  <input
                    type="text"
                    placeholder="Entrez le nom du plat"
                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      !itemData.name && error ? "border-red-500" : ""
                    }`}
                    value={itemData.name}
                    onChange={(e) => setItemData({ ...itemData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Menu *</label>
                  <select
                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      !itemData.menuId && error ? "border-red-500" : ""
                    }`}
                    value={itemData.menuId}
                    onChange={(e) => setItemData({ ...itemData, menuId: e.target.value })}
                  >
                    <option value="">Sélectionner un menu</option>
                    {menus.map((menu) => (
                      <option key={menu.id} value={menu.id}>
                        {menu.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                  <select
                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      !itemData.categoryId && error ? "border-red-500" : ""
                    }`}
                    value={itemData.categoryId}
                    onChange={(e) => setItemData({ ...itemData, categoryId: e.target.value })}
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de prix *</label>
                  <select
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={itemData.priceType}
                    onChange={(e) => setItemData({ ...itemData, priceType: e.target.value })}
                  >
                    <option value="single">Prix unique</option>
                    <option value="sizes">Prix par taille (L/XL)</option>
                  </select>
                </div>
                {itemData.priceType === "single" ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA) *</label>
                    <input
                      type="number"
                      placeholder="Prix"
                      className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        !itemData.price && error ? "border-red-500" : ""
                      }`}
                      value={itemData.price}
                      onChange={(e) => setItemData({ ...itemData, price: e.target.value })}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix par taille (FCFA) *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Prix L"
                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                          !itemData.sizes.L && error ? "border-red-500" : ""
                        }`}
                        value={itemData.sizes.L}
                        onChange={(e) => setItemData({ ...itemData, sizes: { ...itemData.sizes, L: e.target.value } })}
                      />
                      <input
                        type="number"
                        placeholder="Prix XL"
                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                          !itemData.sizes.XL && error ? "border-red-500" : ""
                        }`}
                        value={itemData.sizes.XL}
                        onChange={(e) => setItemData({ ...itemData, sizes: { ...itemData.sizes, XL: e.target.value } })}
                      />
                    </div>
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    placeholder="Décrivez le plat..."
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-y"
                    rows="3"
                    value={itemData.description}
                    onChange={(e) => setItemData({ ...itemData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode de vente</label>
                  <select
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={itemData.saleMode}
                    onChange={(e) => setItemData({ ...itemData, saleMode: e.target.value })}
                  >
                    <option value="pack">Pack</option>
                    <option value="kilo">Kilo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Images</label>
                  <input
                    type="file"
                    multiple
                    className="w-full p-2 border rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      const previews = files.map((file) => URL.createObjectURL(file));
                      setItemData({
                        ...itemData,
                        covers: editingItem ? [...itemData.covers, ...files] : files,
                        coverPreviews: editingItem ? [...itemData.coverPreviews, ...previews] : previews,
                      });
                    }}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Extras</label>
                  <div className="flex flex-wrap gap-2">
                    {extraLists.length > 0 ? (
                      extraLists.map((extra) => (
                        <div
                          key={extra.id}
                          className={`px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                            itemData.extraLists.includes(extra.id)
                              ? "bg-green-500 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() => {
                            setItemData({
                              ...itemData,
                              extraLists: itemData.extraLists.includes(extra.id)
                                ? itemData.extraLists.filter((id) => id !== extra.id)
                                : [...itemData.extraLists, extra.id],
                            });
                          }}
                        >
                          {extra.name} ({extra.extraListElements.length})
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">Aucune liste d'extras disponible</p>
                    )}
                  </div>
                </div>
              </div>
              {itemData.coverPreviews?.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prévisualisation des images</label>
                  <div className="flex flex-wrap gap-2">
                    {itemData.coverPreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Prévisualisation ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                        <button
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          onClick={() => {
                            const newCovers = itemData.covers.filter((_, i) => i !== index);
                            const newPreviews = itemData.coverPreviews.filter((_, i) => i !== index);
                            setItemData({ ...itemData, covers: newCovers, coverPreviews: newPreviews });
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Jours de disponibilité</label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        itemData.scheduledDay.includes(day)
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => handleDaySelection(day)}
                    >
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-700 hover:bg-red-200"
                    onClick={() => setItemData({ ...itemData, scheduledDay: [] })}
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>
              <div className="mt-6 flex gap-4">
                <button
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                  onClick={editingItem ? () => updateItem(editingItem.id, itemData) : addItem}
                >
                  {editingItem ? "Mettre à jour" : "Ajouter le plat"}
                </button>
                {editingItem && (
                  <button
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    onClick={resetItemForm}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>

            {/* Liste des Plats */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Liste des plats</h3>
              {items.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucun plat ajouté pour le moment</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                    >
                      <div className="flex items-start space-x-4">
                        {item.covers?.length > 0 ? (
                          <div className="relative w-24 h-24">
                            <img
                              src={item.covers[0]}
                              alt={item.name}
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => (e.target.src = "/img/default.png")}
                            />
                            {item.covers.length > 1 && (
                              <span className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs rounded-full px-2 py-1">
                                +{item.covers.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-gray-500 text-sm">Aucune image</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{item.name}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                          {item.price ? (
                            <p className="text-green-600 font-medium mt-1">{formatPrice(item.price)} FCFA</p>
                          ) : (
                            <p className="text-green-600 font-medium mt-1">
                              L: {formatPrice(item.sizes?.L)} FCFA | XL: {formatPrice(item.sizes?.XL)} FCFA
                            </p>
                          )}
                          {item.menuId && (
                            <p className="text-xs text-gray-500 mt-1">
                              Menu: {menus.find((m) => m.id === item.menuId)?.name || item.menuId}
                            </p>
                          )}
                          {item.scheduledDay.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Disponible: {item.scheduledDay.join(", ")}
                            </p>
                          )}
                          {item.extraLists?.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Extras: {item.extraLists.map((id) => extraLists.find((ex) => ex.id === id)?.name || id).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-between">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          onClick={() => startEditing(item)}
                        >
                          Modifier
                        </button>
                        <button
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                          onClick={() => deleteItem(item.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extras */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Créer une Extra List</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'extra list *</label>
                  <input
                    type="text"
                    placeholder="Nom de l'extra list"
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={extraListData.name}
                    onChange={(e) => setExtraListData({ ...extraListData, name: e.target.value })}
                  />
                </div>
                {extraListData.extraListElements.map((el, index) => (
                  <div key={index} className="p-2 border rounded-lg">
                    <input
                      type="text"
                      placeholder="Nom de l'élément"
                      className="w-full p-2 border rounded-lg mb-2"
                      value={el.name}
                      onChange={(e) => updateExtraElement(index, "name", e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Prix (facultatif)"
                      className="w-full p-2 border rounded-lg mb-2"
                      value={el.price}
                      onChange={(e) => updateExtraElement(index, "price", e.target.value)}
                    />
                    <div className="flex gap-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="mr-2"
                          checked={el.required}
                          onChange={(e) => updateExtraElement(index, "required", e.target.checked)}
                        />
                        <label className="text-sm">Obligatoire</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="mr-2"
                          checked={el.multiple}
                          onChange={(e) => updateExtraElement(index, "multiple", e.target.checked)}
                        />
                        <label className="text-sm">Multiple</label>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  className="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                  onClick={addExtraElement}
                >
                  Ajouter un élément
                </button>
              </div>
              <div className="mt-4">
                <button
                  className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                  onClick={addExtraList}
                >
                  Créer Extra List
                </button>
              </div>
            </div>

            {/* Liste des Extras */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Liste des Extras</h3>
              {extraLists.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucune extra list ajoutée</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2">Nom</th>
                      <th className="text-left p-2">Éléments</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraLists.map((extra) => (
                      <tr key={extra.id}>
                        <td className="p-2">{extra.name}</td>
                        <td className="p-2">
                          {extra.extraListElements
                            ?.map((el) =>
                              `${el.name}${el.price ? ` (${el.price} FCFA)` : ""} - ${
                                el.required ? "Obligatoire" : el.multiple ? "Multiple" : "Optionnel"
                              }`
                            )
                            .join(", ") || "Aucun élément"}
                        </td>
                        <td className="p-2">
                          <button
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                            onClick={() => deleteExtraList(extra.id)}
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuAndItems;