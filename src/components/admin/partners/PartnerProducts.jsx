import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaSearch } from 'react-icons/fa';

const PartnerProducts = ({ currentRestaurantId }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    partnerName: '',
    productName: '',
    description: '',
    price: '',
    category: '',
    available: true,
  });

  useEffect(() => {
    if (currentRestaurantId) {
      loadProducts();
    }
  }, [currentRestaurantId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'partnerProducts'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erreur chargement produits:', e);
      toast.error('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      partnerName: '',
      productName: '',
      description: '',
      price: '',
      category: '',
      available: true,
    });
    setSelectedProduct(null);
    setShowModal(false);
  };

  const handleSubmit = async () => {
    try {
      if (!form.partnerName.trim() || !form.productName.trim() || !form.price) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }

      const productData = {
        partnerName: form.partnerName.trim(),
        productName: form.productName.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
        category: form.category.trim(),
        available: form.available,
        restaurantId: currentRestaurantId,
        updatedAt: serverTimestamp(),
      };

      if (selectedProduct) {
        await updateDoc(doc(db, 'partnerProducts', selectedProduct.id), productData);
        toast.success('Produit mis à jour avec succès');
      } else {
        await addDoc(collection(db, 'partnerProducts'), {
          ...productData,
          createdAt: serverTimestamp(),
        });
        toast.success('Produit ajouté avec succès');
      }

      resetForm();
      loadProducts();
    } catch (e) {
      console.error('Erreur sauvegarde produit:', e);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setForm({
      partnerName: product.partnerName || '',
      productName: product.productName || '',
      description: product.description || '',
      price: product.price || '',
      category: product.category || '',
      available: product.available !== false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce produit ?')) return;
    try {
      await deleteDoc(doc(db, 'partnerProducts', id));
      toast.success('Produit supprimé');
      loadProducts();
    } catch (e) {
      console.error('Erreur suppression:', e);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleAvailability = async (product) => {
    try {
      await updateDoc(doc(db, 'partnerProducts', product.id), {
        available: !product.available,
        updatedAt: serverTimestamp(),
      });
      toast.success('Disponibilité mise à jour');
      loadProducts();
    } catch (e) {
      console.error('Erreur mise à jour:', e);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.partnerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un produit, partenaire ou catégorie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <FaPlus /> Nouveau Produit
        </button>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="text-center py-8 text-blue-600">Chargement...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-blue-700">
              <tr>
                <th className="px-4 py-3 text-left">Partenaire</th>
                <th className="px-4 py-3 text-left">Produit</th>
                <th className="px-4 py-3 text-left">Catégorie</th>
                <th className="px-4 py-3 text-left">Prix</th>
                <th className="px-4 py-3 text-left">Disponibilité</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-blue-50">
                  <td className="px-4 py-3 font-medium">{product.partnerName}</td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{product.productName}</div>
                      {product.description && (
                        <div className="text-xs text-gray-500 mt-1">{product.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {product.category && (
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {product.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {product.price?.toLocaleString()} FCFA
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAvailability(product)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        product.available
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {product.available ? 'Disponible' : 'Indisponible'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Aucun produit trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
          onClick={resetForm}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-blue-700 mb-4">
              {selectedProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du partenaire *
                </label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={form.partnerName}
                  onChange={(e) => setForm({ ...form, partnerName: e.target.value })}
                  placeholder="Ex: Restaurant ABC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du produit *
                </label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  placeholder="Ex: Pizza Margherita"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded"
                  rows="3"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description du produit..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix (FCFA) *
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border rounded"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="5000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie
                </label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Ex: Pizza, Burger..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.available}
                    onChange={(e) => setForm({ ...form, available: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Produit disponible</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="px-4 py-2 border rounded hover:bg-gray-50"
                onClick={resetForm}
              >
                Annuler
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleSubmit}
              >
                {selectedProduct ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerProducts;
