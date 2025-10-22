import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
  Timestamp, // Added import
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { useRestaurantContext } from "./restaurantcontext";
import { db, storage } from "../firebase";
import { formatPrice, convertPrice } from "../utils/orderUtils";

const RestaurantMenuManager = ({ activeSubSection }) => {
  const { currentRestaurantId, items, setItems, extraLists, setExtraLists, error, setError, loading, setLoading } =
    useRestaurantContext();

  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingMenu, setEditingMenu] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingExtraList, setEditingExtraList] = useState(null);
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

  const DAYS_OF_WEEK = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

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

  const resetExtraListForm = () => {
    setExtraListData({
      name: "",
      extraListElements: [{ name: "", price: "", required: false, multiple: false }],
    });
    setEditingExtraList(null);
  };

  const uploadImages = useCallback(async (files) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const validFiles = Array.from(files).filter((file) => allowedTypes.includes(file.type) && file.size <= maxSize);

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
  }, [setError]);

  useEffect(() => {
    if (!currentRestaurantId) return;

    const fetchStaticData = async () => {
      try {
        setLoading(true);
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
      } finally {
        setLoading(false);
      }
    };

    fetchStaticData();
  }, [currentRestaurantId, setItems, setExtraLists, setError, setLoading]);

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

      if (window.fbq) {
        window.fbq("trackCustom", "AddMenu", {
          content_ids: [docRef.id],
          content_name: menuData.name,
          content_type: "menu",
          restaurant_id: currentRestaurantId,
        });
      }

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
      const newCovers = menuData.covers.filter((file) => file instanceof File);
      const existingCovers = menuData.covers.filter((url) => typeof url === "string");
      const uploadedCovers = newCovers.length > 0 ? await uploadImages(newCovers) : [];
      const updatedCovers = [...existingCovers, ...uploadedCovers];
      const updatedData = {
        name: menuData.name,
        covers: updatedCovers,
        updatedAt: Timestamp.now(),
      };
      await updateDoc(doc(db, "menus", editingMenu.id), updatedData);
      setMenus(menus.map((menu) => (menu.id === editingMenu.id ? { ...menu, ...updatedData } : menu)));
      setEditingMenu(null);
      setMenuData({ name: "", covers: [], coverPreviews: [] });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du menu:", error);
      setError("Erreur lors de la mise à jour du menu : " + error.message);
    } finally {
      setLoading(false);
    }
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

  const startEditingMenu = (menu) => {
    setEditingMenu(menu);
    setMenuData({
      name: menu.name,
      covers: menu.covers || [],
      coverPreviews: menu.covers || [],
    });
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

      if (window.fbq) {
        window.fbq("trackCustom", "AddCategory", {
          content_ids: [docRef.id],
          content_name: categoryData.name,
          content_type: "category",
          restaurant_id: currentRestaurantId,
        });
      }
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
        categories.map((category) => (category.id === editingCategory.id ? { ...category, ...updatedData } : category))
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

  const deleteCategory = async (categoryId) => {
    try {
      await deleteDoc(doc(db, "categories", categoryId));
      setCategories(categories.filter((category) => category.id !== categoryId));
    } catch (error) {
      console.error("Erreur lors de la suppression de la catégorie:", error);
      setError("Erreur lors de la suppression de la catégorie");
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
      setLoading(true);
      setError(null);
      const uploadedCovers = itemData.covers.length > 0 ? await uploadImages(itemData.covers) : [];
      if (itemData.covers.length > 0 && uploadedCovers.length === 0) {
        setError("Échec du téléchargement des images");
        return;
      }
      const priceValue =
        itemData.priceType === "single"
          ? convertPrice(itemData.price)
          : Math.min(convertPrice(itemData.sizes.L || 0), convertPrice(itemData.sizes.XL || 0));
      if (isNaN(priceValue)) {
        setError("Prix invalide");
        return;
      }
      const newItem = {
        ...itemData,
        covers: uploadedCovers,
        restaurantId: currentRestaurantId,
        price: itemData.priceType === "single" ? convertPrice(itemData.price) : undefined,
        sizes: itemData.priceType === "sizes" ? itemData.sizes : undefined,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "items"), newItem);
      setItems([...items, { id: docRef.id, ...newItem }]);
      await updateDoc(doc(db, "menus", itemData.menuId), { items: arrayUnion(docRef.id) });

      if (window.fbq) {
        window.fbq("track", "AddToCart", {
          content_ids: [docRef.id],
          content_name: itemData.name,
          content_type: "product",
          restaurant_id: currentRestaurantId,
        });
      }

      resetItemForm();
    } catch (error) {
      console.error("Erreur lors de l'ajout du plat:", error);
      setError("Erreur lors de l'ajout du plat : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async () => {
    if (!editingItem || !itemData.name || !itemData.categoryId || !itemData.menuId) {
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
      setLoading(true);
      setError(null);
      const newCovers = itemData.covers.filter((file) => file instanceof File);
      const existingCovers = itemData.covers.filter((url) => typeof url === "string");
      const uploadedCovers = newCovers.length > 0 ? await uploadImages(newCovers) : [];
      const updatedCovers = [...existingCovers, ...uploadedCovers];
      const priceValue =
        itemData.priceType === "single"
          ? convertPrice(itemData.price)
          : Math.min(convertPrice(itemData.sizes.L || 0), convertPrice(itemData.sizes.XL || 0));
      if (isNaN(priceValue)) {
        setError("Prix invalide");
        return;
      }
      const updatedData = {
        ...itemData,
        covers: updatedCovers,
        price: itemData.priceType === "single" ? convertPrice(itemData.price) : undefined,
        sizes: itemData.priceType === "sizes" ? itemData.sizes : undefined,
        updatedAt: Timestamp.now(),
      };
      await updateDoc(doc(db, "items", editingItem.id), updatedData);
      setItems(items.map((item) => (item.id === editingItem.id ? { ...item, ...updatedData } : item)));
      resetItemForm();
    } catch (error) {
      console.error("Erreur lors de la mise à jour du plat:", error);
      setError("Erreur lors de la mise à jour du plat : " + error.message);
    } finally {
      setLoading(false);
    }
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

  const startEditingItem = (item) => {
    setEditingItem(item);
    setItemData({
      name: item.name,
      description: item.description || "",
      priceType: item.price ? "single" : "sizes",
      price: item.price || "",
      sizes: item.sizes || { L: "", XL: "" },
      saleMode: item.saleMode || "pack",
      categoryId: item.categoryId || "",
      available: item.available !== undefined ? item.available : true,
      scheduledDay: item.scheduledDay || [],
      needAssortement: item.needAssortement || false,
      assortments: item.assortments || [],
      extraLists: item.extraLists || [],
      quantityleft: item.quantityleft || 0,
      covers: item.covers || [],
      coverPreviews: item.covers || [],
      menuId: item.menuId || "",
    });
  };

  const addExtraList = async () => {
    if (!extraListData.name || extraListData.extraListElements.some((el) => !el.name)) {
      setError("Le nom de l'extra list et tous les noms des extras sont requis.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newExtraList = {
        name: extraListData.name,
        extraListElements: extraListData.extraListElements.map((el) => ({
          ...el,
          price: convertPrice(el.price || 0),
        })),
        restaurantId: currentRestaurantId,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, "extraLists"), newExtraList);
      setExtraLists([...extraLists, { id: docRef.id, ...newExtraList }]);
      resetExtraListForm();
    } catch (error) {
      console.error("Erreur lors de la création de l'extra list:", error);
      setError("Erreur lors de la création de l'extra list : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateExtraList = async () => {
    if (!editingExtraList || !extraListData.name || extraListData.extraListElements.some((el) => !el.name)) {
      setError("Le nom de l'extra list et tous les noms des extras sont requis.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const updatedData = {
        name: extraListData.name,
        extraListElements: extraListData.extraListElements.map((el) => ({
          ...el,
          price: convertPrice(el.price || 0),
        })),
        updatedAt: Timestamp.now(),
      };
      await updateDoc(doc(db, "extraLists", editingExtraList.id), updatedData);
      setExtraLists(extraLists.map((ex) => (ex.id === editingExtraList.id ? { ...ex, ...updatedData } : ex)));
      resetExtraListForm();
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'extra list:", error);
      setError("Erreur lors de la mise à jour de l'extra list : " + error.message);
    } finally {
      setLoading(false);
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

  const startEditingExtraList = (extraList) => {
    setEditingExtraList(extraList);
    setExtraListData({
      name: extraList.name,
      extraListElements: extraList.extraListElements || [{ name: "", price: "", required: false, multiple: false }],
    });
  };

  const handleCoverChange = (e, setData, field) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => URL.createObjectURL(file));
    setData((prev) => ({
      ...prev,
      [field]: files,
      coverPreviews: previews,
    }));
  };

  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCategoryData({
        ...categoryData,
        iconFile: file,
        iconPreview: URL.createObjectURL(file),
      });
    }
  };

  const addAssortment = () => {
    setItemData({
      ...itemData,
      assortments: [...itemData.assortments, { name: "", items: [] }],
    });
  };

  const updateAssortment = (index, field, value) => {
    const updatedAssortments = [...itemData.assortments];
    updatedAssortments[index] = { ...updatedAssortments[index], [field]: value };
    setItemData({ ...itemData, assortments: updatedAssortments });
  };

  const removeAssortment = (index) => {
    setItemData({
      ...itemData,
      assortments: itemData.assortments.filter((_, i) => i !== index),
    });
  };

  const addExtraListElement = () => {
    setExtraListData({
      ...extraListData,
      extraListElements: [...extraListData.extraListElements, { name: "", price: "", required: false, multiple: false }],
    });
  };

  const updateExtraListElement = (index, field, value) => {
    const updatedElements = [...extraListData.extraListElements];
    updatedElements[index] = { ...updatedElements[index], [field]: value };
    setExtraListData({ ...extraListData, extraListElements: updatedElements });
  };

  const removeExtraListElement = (index) => {
    setExtraListData({
      ...extraListData,
      extraListElements: extraListData.extraListElements.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="p-4 md:p-6">
      {loading && <p className="text-gray-600">Chargement...</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {activeSubSection === "menus" && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">{editingMenu ? "Modifier le Menu" : "Ajouter un Menu"}</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nom du menu"
              className="w-full p-3 border rounded-lg"
              value={menuData.name}
              onChange={(e) => setMenuData({ ...menuData, name: e.target.value })}
            />
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleCoverChange(e, setMenuData, "covers")}
              className="w-full p-3 border rounded-lg"
            />
            {menuData.coverPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {menuData.coverPreviews.map((preview, index) => (
                  <img key={index} src={preview} alt="Aperçu" className="w-24 h-24 object-cover rounded" />
                ))}
              </div>
            )}
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              onClick={editingMenu ? updateMenu : addMenu}
              disabled={loading}
            >
              {loading ? "Enregistrement..." : editingMenu ? "Mettre à jour" : "Ajouter"}
            </button>
            {editingMenu && (
              <button
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg ml-2"
                onClick={() => {
                  setEditingMenu(null);
                  setMenuData({ name: "", covers: [], coverPreviews: [] });
                }}
              >
                Annuler
              </button>
            )}
          </div>
          <h3 className="text-xl font-semibold mt-8 mb-4">Liste des Menus</h3>
          <div className="space-y-4">
            {menus.map((menu) => (
              <div key={menu.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{menu.name}</p>
                  {menu.covers?.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {menu.covers.map((cover, index) => (
                        <img key={index} src={cover} alt={menu.name} className="w-16 h-16 object-cover rounded" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    onClick={() => startEditingMenu(menu)}
                  >
                    Modifier
                  </button>
                  <button
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    onClick={() => deleteMenu(menu.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubSection === "categories" && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">{editingCategory ? "Modifier la Catégorie" : "Ajouter une Catégorie"}</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nom de la catégorie"
              className="w-full p-3 border rounded-lg"
              value={categoryData.name}
              onChange={(e) => setCategoryData({ ...categoryData, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Description"
              className="w-full p-3 border rounded-lg"
              value={categoryData.description}
              onChange={(e) => setCategoryData({ ...categoryData, description: e.target.value })}
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleIconChange}
              className="w-full p-3 border rounded-lg"
            />
            {categoryData.iconPreview && (
              <img src={categoryData.iconPreview} alt="Aperçu de l'icône" className="w-24 h-24 object-cover rounded mt-2" />
            )}
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              onClick={editingCategory ? updateCategory : addCategory}
              disabled={loading}
            >
              {loading ? "Enregistrement..." : editingCategory ? "Mettre à jour" : "Ajouter"}
            </button>
            {editingCategory && (
              <button
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg ml-2"
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryData({ name: "", description: "", icon: "", iconFile: null, iconPreview: "" });
                }}
              >
                Annuler
              </button>
            )}
          </div>
          <h3 className="text-xl font-semibold mt-8 mb-4">Liste des Catégories</h3>
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-sm text-gray-600">{category.description}</p>
                  {category.icon && (
                    <img src={category.icon} alt={category.name} className="w-16 h-16 object-cover rounded mt-2" />
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    onClick={() => startEditingCategory(category)}
                  >
                    Modifier
                  </button>
                  <button
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    onClick={() => deleteCategory(category.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubSection === "items" && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">{editingItem ? "Modifier le Plat" : "Ajouter un Plat"}</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nom du plat"
              className="w-full p-3 border rounded-lg"
              value={itemData.name}
              onChange={(e) => setItemData({ ...itemData, name: e.target.value })}
            />
            <textarea
              placeholder="Description"
              className="w-full p-3 border rounded-lg"
              value={itemData.description}
              onChange={(e) => setItemData({ ...itemData, description: e.target.value })}
            />
            <select
              className="w-full p-3 border rounded-lg"
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
            <select
              className="w-full p-3 border rounded-lg"
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
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="priceType"
                  value="single"
                  checked={itemData.priceType === "single"}
                  onChange={() => setItemData({ ...itemData, priceType: "single" })}
                  className="mr-2"
                />
                Prix unique
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="priceType"
                  value="sizes"
                  checked={itemData.priceType === "sizes"}
                  onChange={() => setItemData({ ...itemData, priceType: "sizes" })}
                  className="mr-2"
                />
                Prix par taille
              </label>
            </div>
            {itemData.priceType === "single" ? (
              <input
                type="number"
                placeholder="Prix"
                className="w-full p-3 border rounded-lg"
                value={itemData.price}
                onChange={(e) => setItemData({ ...itemData, price: e.target.value })}
              />
            ) : (
              <div className="flex space-x-4">
                <input
                  type="number"
                  placeholder="Prix L"
                  className="w-full p-3 border rounded-lg"
                  value={itemData.sizes.L}
                  onChange={(e) => setItemData({ ...itemData, sizes: { ...itemData.sizes, L: e.target.value } })}
                />
                <input
                  type="number"
                  placeholder="Prix XL"
                  className="w-full p-3 border rounded-lg"
                  value={itemData.sizes.XL}
                  onChange={(e) => setItemData({ ...itemData, sizes: { ...itemData.sizes, XL: e.target.value } })}
                />
              </div>
            )}
            <select
              className="w-full p-3 border rounded-lg"
              value={itemData.saleMode}
              onChange={(e) => setItemData({ ...itemData, saleMode: e.target.value })}
            >
              <option value="pack">Pack</option>
              <option value="unit">Unité</option>
            </select>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={itemData.available}
                onChange={(e) => setItemData({ ...itemData, available: e.target.checked })}
                className="mr-2"
              />
              Disponible
            </label>
            <div>
              <p className="font-semibold mb-2">Jours de disponibilité</p>
              {DAYS_OF_WEEK.map((day) => (
                <label key={day} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={itemData.scheduledDay.includes(day)}
                    onChange={(e) => {
                      const updatedDays = e.target.checked
                        ? [...itemData.scheduledDay, day]
                        : itemData.scheduledDay.filter((d) => d !== day);
                      setItemData({ ...itemData, scheduledDay: updatedDays });
                    }}
                    className="mr-2"
                  />
                  {day}
                </label>
              ))}
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={itemData.needAssortement}
                onChange={(e) => setItemData({ ...itemData, needAssortement: e.target.checked })}
                className="mr-2"
              />
              Nécessite un assortiment
            </label>
            {itemData.needAssortement && (
              <div className="space-y-2">
                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  onClick={addAssortment}
                >
                  Ajouter un assortiment
                </button>
                {itemData.assortments.map((assortment, index) => (
                  <div key={index} className="flex space-x-2 items-center">
                    <input
                      type="text"
                      placeholder="Nom de l'assortiment"
                      className="w-full p-2 border rounded-lg"
                      value={assortment.name}
                      onChange={(e) => updateAssortment(index, "name", e.target.value)}
                    />
                    <button
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                      onClick={() => removeAssortment(index)}
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="font-semibold mb-2">Extras associés</p>
              {extraLists.map((extraList) => (
                <label key={extraList.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={itemData.extraLists.includes(extraList.id)}
                    onChange={(e) => {
                      const updatedExtras = e.target.checked
                        ? [...itemData.extraLists, extraList.id]
                        : itemData.extraLists.filter((id) => id !== extraList.id);
                      setItemData({ ...itemData, extraLists: updatedExtras });
                    }}
                    className="mr-2"
                  />
                  {extraList.name}
                </label>
              ))}
            </div>
            <input
              type="number"
              placeholder="Quantité restante"
              className="w-full p-3 border rounded-lg"
              value={itemData.quantityleft}
              onChange={(e) => setItemData({ ...itemData, quantityleft: Number(e.target.value) })}
            />
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleCoverChange(e, setItemData, "covers")}
              className="w-full p-3 border rounded-lg"
            />
            {itemData.coverPreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {itemData.coverPreviews.map((preview, index) => (
                  <img key={index} src={preview} alt="Aperçu" className="w-24 h-24 object-cover rounded" />
                ))}
              </div>
            )}
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              onClick={editingItem ? updateItem : addItem}
              disabled={loading}
            >
              {loading ? "Enregistrement..." : editingItem ? "Mettre à jour" : "Ajouter"}
            </button>
            {editingItem && (
              <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg ml-2" onClick={resetItemForm}>
                Annuler
              </button>
            )}
          </div>
          <h3 className="text-xl font-semibold mt-8 mb-4">Liste des Plats</h3>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.description}</p>
                  <p className="text-sm">
                    Prix: {item.price ? formatPrice(item.price) : `${formatPrice(item.sizes?.L)} / ${formatPrice(item.sizes?.XL)}`} FCFA
                  </p>
                  <p className="text-sm">Catégorie: {categories.find((c) => c.id === item.categoryId)?.name || "Non spécifié"}</p>
                  <p className="text-sm">Menu: {menus.find((m) => m.id === item.menuId)?.name || "Non spécifié"}</p>
                  {item.covers?.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {item.covers.map((cover, index) => (
                        <img key={index} src={cover} alt={item.name} className="w-16 h-16 object-cover rounded" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    onClick={() => startEditingItem(item)}
                  >
                    Modifier
                  </button>
                  <button
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    onClick={() => deleteItem(item.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubSection === "extras" && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">{editingExtraList ? "Modifier l'Extra List" : "Ajouter une Extra List"}</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nom de l'extra list"
              className="w-full p-3 border rounded-lg"
              value={extraListData.name}
              onChange={(e) => setExtraListData({ ...extraListData, name: e.target.value })}
            />
            {extraListData.extraListElements.map((element, index) => (
              <div key={index} className="flex space-x-2 items-center">
                <input
                  type="text"
                  placeholder="Nom de l'extra"
                  className="w-full p-2 border rounded-lg"
                  value={element.name}
                  onChange={(e) => updateExtraListElement(index, "name", e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Prix"
                  className="w-1/3 p-2 border rounded-lg"
                  value={element.price}
                  onChange={(e) => updateExtraListElement(index, "price", e.target.value)}
                />
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={element.required}
                    onChange={(e) => updateExtraListElement(index, "required", e.target.checked)}
                    className="mr-2"
                  />
                  Requis
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={element.multiple}
                    onChange={(e) => updateExtraListElement(index, "multiple", e.target.checked)}
                    className="mr-2"
                  />
                  Multiple
                </label>
                <button
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                  onClick={() => removeExtraListElement(index)}
                >
                  Supprimer
                </button>
              </div>
            ))}
            <button
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              onClick={addExtraListElement}
            >
              Ajouter un extra
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              onClick={editingExtraList ? updateExtraList : addExtraList}
              disabled={loading}
            >
              {loading ? "Enregistrement..." : editingExtraList ? "Mettre à jour" : "Ajouter"}
            </button>
            {editingExtraList && (
              <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg ml-2" onClick={resetExtraListForm}>
                Annuler
              </button>
            )}
          </div>
          <h3 className="text-xl font-semibold mt-8 mb-4">Liste des Extras</h3>
          <div className="space-y-4">
            {extraLists.map((extraList) => (
              <div key={extraList.id} className="p-4 border rounded-lg bg-gray-50">
                <p className="font-semibold">{extraList.name}</p>
                <ul className="list-disc ml-5 text-sm text-gray-600">
                  {extraList.extraListElements.map((element, index) => (
                    <li key={index}>
                      {element.name} {element.price ? `(${formatPrice(element.price)} FCFA)` : ""}
                      {element.required && <span className="ml-2 text-blue-600">(Requis)</span>}
                      {element.multiple && <span className="ml-2 text-green-600">(Multiple)</span>}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 mt-2">
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    onClick={() => startEditingExtraList(extraList)}
                  >
                    Modifier
                  </button>
                  <button
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    onClick={() => deleteExtraList(extraList.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantMenuManager;