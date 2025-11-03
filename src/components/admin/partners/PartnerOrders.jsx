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
import { FaPlus, FaEdit, FaTrash, FaSearch, FaMotorcycle } from 'react-icons/fa';

const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  IN_DELIVERY: 'in_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête',
  in_delivery: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-purple-100 text-purple-700',
  ready: 'bg-green-100 text-green-700',
  in_delivery: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-200 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
};

const PartnerOrders = ({ currentRestaurantId }) => {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [deliverers, setDeliverers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    productId: '',
    quantity: 1,
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    quartierId: '',
    deliveryFee: 0,
    notes: '',
    status: ORDER_STATUS.PENDING,
    assignedDeliverer: '',
  });

  useEffect(() => {
    if (currentRestaurantId) {
      loadOrders();
      loadProducts();
      loadQuartiers();
      loadDeliverers();
    }
  }, [currentRestaurantId]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'partnerOrders'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erreur chargement commandes:', e);
      toast.error('Erreur lors du chargement des commandes');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const q = query(
        collection(db, 'partnerProducts'),
        where('restaurantId', '==', currentRestaurantId),
        where('available', '==', true)
      );
      const snap = await getDocs(q);
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erreur chargement produits:', e);
    }
  };

  const loadQuartiers = async () => {
    try {
      const q = query(collection(db, 'quartiers'), orderBy('name'));
      const snap = await getDocs(q);
      setQuartiers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erreur chargement quartiers:', e);
    }
  };

  const loadDeliverers = async () => {
    try {
      const q = query(collection(db, 'deliverers'), where('active', '==', true));
      const snap = await getDocs(q);
      setDeliverers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erreur chargement livreurs:', e);
    }
  };

  const resetForm = () => {
    setForm({
      productId: '',
      quantity: 1,
      customerName: '',
      customerPhone: '',
      deliveryAddress: '',
      quartierId: '',
      deliveryFee: 0,
      notes: '',
      status: ORDER_STATUS.PENDING,
      assignedDeliverer: '',
    });
    setSelectedOrder(null);
    setShowModal(false);
  };

  const handleQuartierChange = (quartierId) => {
    const quartier = quartiers.find((q) => q.id === quartierId);
    setForm({
      ...form,
      quartierId,
      deliveryFee: quartier?.partnerDeliveryFee || quartier?.fee || 0,
    });
  };

  const calculateTotal = () => {
    const product = products.find((p) => p.id === form.productId);
    const productPrice = product ? product.price * form.quantity : 0;
    return productPrice + (form.deliveryFee || 0);
  };

  const handleSubmit = async () => {
    try {
      if (
        !form.productId ||
        !form.customerName.trim() ||
        !form.customerPhone.trim() ||
        !form.deliveryAddress.trim() ||
        !form.quartierId
      ) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }

      const product = products.find((p) => p.id === form.productId);
      const quartier = quartiers.find((q) => q.id === form.quartierId);

      const orderData = {
        productId: form.productId,
        productName: product?.productName || '',
        partnerName: product?.partnerName || '',
        quantity: Number(form.quantity),
        productPrice: product?.price || 0,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        deliveryAddress: form.deliveryAddress.trim(),
        quartierId: form.quartierId,
        quartierName: quartier?.name || '',
        deliveryFee: Number(form.deliveryFee) || 0,
        totalAmount: calculateTotal(),
        notes: form.notes.trim(),
        status: form.status,
        assignedDeliverer: form.assignedDeliverer,
        restaurantId: currentRestaurantId,
        updatedAt: serverTimestamp(),
      };

      if (selectedOrder) {
        await updateDoc(doc(db, 'partnerOrders', selectedOrder.id), orderData);
        toast.success('Commande mise à jour avec succès');
      } else {
        await addDoc(collection(db, 'partnerOrders'), {
          ...orderData,
          createdAt: serverTimestamp(),
        });
        toast.success('Commande enregistrée avec succès');
      }

      resetForm();
      loadOrders();
    } catch (e) {
      console.error('Erreur sauvegarde commande:', e);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (order) => {
    setSelectedOrder(order);
    setForm({
      productId: order.productId || '',
      quantity: order.quantity || 1,
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      deliveryAddress: order.deliveryAddress || '',
      quartierId: order.quartierId || '',
      deliveryFee: order.deliveryFee || 0,
      notes: order.notes || '',
      status: order.status || ORDER_STATUS.PENDING,
      assignedDeliverer: order.assignedDeliverer || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette commande ?')) return;
    try {
      await deleteDoc(doc(db, 'partnerOrders', id));
      toast.success('Commande supprimée');
      loadOrders();
    } catch (e) {
      console.error('Erreur suppression:', e);
      toast.error('Erreur lors de la suppression');
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'partnerOrders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success('Statut mis à jour');
      loadOrders();
    } catch (e) {
      console.error('Erreur mise à jour statut:', e);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.partnerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerPhone?.includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une commande..."
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
          <FaPlus /> Nouvelle Commande
        </button>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="text-center py-8 text-blue-600">Chargement...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-blue-700">
              <tr>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Produit</th>
                <th className="px-4 py-3 text-left">Quartier</th>
                <th className="px-4 py-3 text-left">Montant</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Livreur</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-blue-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{order.customerName}</div>
                      <div className="text-xs text-gray-500">{order.customerPhone}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{order.productName}</div>
                      <div className="text-xs text-gray-500">
                        {order.partnerName} × {order.quantity}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{order.quartierName}</td>
                  <td className="px-4 py-3 font-semibold">
                    {order.totalAmount?.toLocaleString()} FCFA
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        STATUS_COLORS[order.status]
                      }`}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {order.assignedDeliverer ? (
                      <div className="flex items-center gap-1 text-xs">
                        <FaMotorcycle className="text-blue-600" />
                        {order.assignedDeliverer}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Non assigné</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(order)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    Aucune commande trouvée
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
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={resetForm}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-blue-700 mb-4">
              {selectedOrder ? 'Modifier la commande' : 'Nouvelle commande'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produit *
                </label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                >
                  <option value="">Sélectionner un produit</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productName} - {p.partnerName} ({p.price?.toLocaleString()} FCFA)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité *
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border rounded"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du client *
                </label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone *
                </label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  placeholder="+237 6XX XXX XXX"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse de livraison *
                </label>
                <input
                  className="w-full px-3 py-2 border rounded"
                  value={form.deliveryAddress}
                  onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                  placeholder="Adresse complète"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quartier *
                </label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={form.quartierId}
                  onChange={(e) => handleQuartierChange(e.target.value)}
                >
                  <option value="">Sélectionner un quartier</option>
                  {quartiers.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name} ({(q.partnerDeliveryFee || q.fee)?.toLocaleString()} FCFA)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frais de livraison (FCFA)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border rounded"
                  value={form.deliveryFee}
                  onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Livreur</label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={form.assignedDeliverer}
                  onChange={(e) => setForm({ ...form, assignedDeliverer: e.target.value })}
                >
                  <option value="">Non assigné</option>
                  {deliverers.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2 border rounded"
                  rows="2"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes supplémentaires..."
                />
              </div>

              <div className="md:col-span-2 bg-blue-50 p-3 rounded">
                <div className="text-sm font-medium text-gray-700">Montant total</div>
                <div className="text-2xl font-bold text-blue-700">
                  {calculateTotal().toLocaleString()} FCFA
                </div>
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
                {selectedOrder ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerOrders;
