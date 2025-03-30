import React, { useEffect, useState } from "react";
import { db, storage } from "../firebase"; // Assure-toi d'avoir configuré Firebase Storage
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const Admin = () => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    prix: "",
    image: null,
    service: "crunch",
    jour: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [activeTab, setActiveTab] = useState("products"); // Onglet actif

  // Récupérer les produits depuis Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      const crunchCollection = await getDocs(collection(db, "crunch"));
      const mangeDabordCollection = await getDocs(collection(db, "mange_dabord"));

      const crunchData = crunchCollection.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const mangeDabordData = mangeDabordCollection.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      setProducts([...crunchData, ...mangeDabordData]);
    };

    const fetchOrders = async () => {
      const ordersCollection = await getDocs(collection(db, "orders"));
      const ordersData = ordersCollection.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
    };

    fetchProducts();
    fetchOrders();
  }, []);

  // Gérer les changements des inputs
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Gérer l'upload d'image
  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setFormData({ ...formData, image: e.target.files[0] });
      setImagePreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  // Ajouter un produit
  const addProduct = async () => {
    if (!formData.nom || !formData.prix || !formData.image)
      return alert("Nom, prix et image obligatoires");

    const imageRef = ref(storage, `images/${formData.image.name}`);
    await uploadBytes(imageRef, formData.image);
    const imageUrl = await getDownloadURL(imageRef);

    const newProduct = {
      nom: formData.nom,
      description: formData.description,
      prix: parseFloat(formData.prix),
      image: imageUrl,
      service: formData.service,
      ...(formData.service === "mange_dabord" && { jour: formData.jour }),
    };

    const collectionRef = collection(db, formData.service);
    const docRef = await addDoc(collectionRef, newProduct);

    setProducts([...products, { id: docRef.id, ...newProduct }]);
    setFormData({ nom: "", description: "", prix: "", image: null, service: "crunch", jour: "" });
    setImagePreview(null);
  };

  // Modifier un produit
  const editProduct = async () => {
    if (!editingId) return;

    let updatedData = { ...formData };

    if (formData.image && typeof formData.image !== "string") {
      const imageRef = ref(storage, `images/${formData.image.name}`);
      await uploadBytes(imageRef, formData.image);
      updatedData.image = await getDownloadURL(imageRef);
    }

    const productRef = doc(db, formData.service, editingId);
    await updateDoc(productRef, updatedData);

    setProducts(products.map((p) => (p.id === editingId ? { id: editingId, ...updatedData } : p)));
    setEditingId(null);
    setFormData({ nom: "", description: "", prix: "", image: null, service: "crunch", jour: "" });
    setImagePreview(null);
  };

  // Charger les données d'un produit pour modification
  const loadProductForEdit = (product) => {
    setFormData(product);
    setEditingId(product.id);
    setImagePreview(product.image);
  };

  // Supprimer un produit
  const deleteProduct = async (id, service) => {
    await deleteDoc(doc(db, service, id));
    setProducts(products.filter((p) => p.id !== id));
  };

  // Gérer le statut des commandes
  const handleOrderStatus = async (id, status, reason = "") => {
    const orderRef = doc(db, "orders", id);
    await updateDoc(orderRef, { status, reason });
    setOrders(orders.map((order) => (order.id === id ? { ...order, status, reason } : order)));
  };

  return (
    <div className="container mt-4">
      <h2>Administration</h2>
      
      {/* Onglets */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab("products")}>
            Gestion des Produits
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab("orders")}>
            Gestion des Commandes
          </button>
        </li>
      </ul>

      {/* Contenu en fonction de l'onglet actif */}
      {activeTab === "products" && (
        <>
          {/* Formulaire d'ajout/modification */}
          <div className="mb-4">
            <input
              type="text"
              name="nom"
              placeholder="Nom du produit"
              className="form-control mb-2"
              value={formData.nom}
              onChange={handleChange}
            />
            <textarea
              name="description"
              placeholder="Description"
              className="form-control mb-2"
              value={formData.description}
              onChange={handleChange}
            ></textarea>
            <input
              type="number"
              name="prix"
              placeholder="Prix"
              className="form-control mb-2"
              value={formData.prix}
              onChange={handleChange}
            />
            <input type="file" className="form-control mb-2" onChange={handleImageChange} />
            {imagePreview && <img src={imagePreview} alt="Aperçu" className="img-thumbnail mb-2" width="100" />}

            <select name="service" className="form-control mb-2" value={formData.service} onChange={handleChange}>
              <option value="crunch">Crunch</option>
              <option value="mange_dabord">Mange d'abord</option>
            </select>

            {formData.service === "mange_dabord" && (
              <input
                type="text"
                name="jour"
                placeholder="Jour de disponibilité"
                className="form-control mb-2"
                value={formData.jour}
                onChange={handleChange}
              />
            )}

            {editingId ? (
              <button className="btn btn-warning" onClick={editProduct}>
                Modifier
              </button>
            ) : (
              <button className="btn btn-success" onClick={addProduct}>
                Ajouter
              </button>
            )}
          </div>

          {/* Liste des produits */}
          <h3>Liste des produits</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Nom</th>
                <th>Description</th>
                <th>Prix</th>
                <th>Service</th>
                <th>Jour</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <img src={p.image} alt={p.nom} width="50" />
                  </td>
                  <td>{p.nom}</td>
                  <td>{p.description}</td>
                  <td>{p.prix} FCFA</td>
                  <td>{p.service}</td>
                  <td>{p.jour || "N/A"}</td>
                  <td>
                    <button className="btn btn-sm btn-primary me-2" onClick={() => loadProductForEdit(p)}>
                      Modifier
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteProduct(p.id, p.service)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {activeTab === "orders" && (
        <>
          {/* Section des commandes */}
          <h3>Gestion des Commandes</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Produits</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.clientName}</td>
                  <td>{order.products.join(", ")}</td>
                  <td>{order.total} FCFA</td>
                  <td>{order.status}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-success me-2"
                      onClick={() => handleOrderStatus(order.id, "Acceptée")}
                    >
                      Accepter
                    </button>
                    <button
                      className="btn btn-sm btn-danger me-2"
                      onClick={() => handleOrderStatus(order.id, "Refusée", "Raison du refus")}
                    >
                      Refuser
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleOrderStatus(order.id, "En attente")}
                    >
                      En attente
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default Admin;