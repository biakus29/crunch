import React, { useEffect, useState } from 'react';
import { db, auth } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaPlus, FaTrash, FaEdit } from 'react-icons/fa';
import { signInWithEmailAndPassword } from 'firebase/auth';

// Dashboard pour les commandes partenaires (livraison à grande échelle)
// Accessible aux rôles: 'manager', 'delivery_manager', 'dev', 'accountant'
const ALLOWED_ROLES = ['manager', 'delivery_manager', 'dev', 'accountant'];

const PartnerDeliveries = ({ currentRestaurantId, userRole }) => {
  const [authUser, setAuthUser] = useState(undefined);
  const [orders, setOrders] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [form, setForm] = useState({
    partnerName: '',
    productName: '',
    qty: 1,
    productPrice: '',
    deliveryLocationId: '',
    deliveryFee: '',
    amountToPay: 0,
  });

  useEffect(() => {
    if (!currentRestaurantId) return;
    loadData();
    loadQuartiers();
  }, [currentRestaurantId]);

  // S'abonner à l'état d'authentification indépendamment du restaurant sélectionné
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setAuthUser(u || null);
    });
    return () => unsubscribe();
  }, []);

  // note: partner authentication is handled by a dedicated login page (/login-partners)

  const loadQuartiers = async () => {
    try {
      const q = query(collection(db, 'quartiers'), orderBy('name'));
      const snap = await getDocs(q);
      setQuartiers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erreur chargement quartiers', e);
      setQuartiers([]);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'partnerOrders'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erreur chargement commandes partenaires', e);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ partnerName: '', productName: '', qty: 1, productPrice: '', deliveryLocationId: '', deliveryFee: '', amountToPay: 0 });
    setSelectedOrder(null);
    setShowModal(false);
  };

  const calculateAmount = (flds = form) => {
    const qty = parseFloat(flds.qty) || 0;
    const price = parseFloat(flds.productPrice) || 0;
    const fee = parseFloat(flds.deliveryFee) || 0;
    return qty * price + fee;
  };

  useEffect(() => {
    setForm(f => ({ ...f, amountToPay: calculateAmount(f) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.qty, form.productPrice, form.deliveryFee]);

  const handleLocationChange = (locationId) => {
    const loc = quartiers.find(q => q.id === locationId);
    // Par défaut, utiliser le fee du quartier; l'utilisateur peut l'éditer
    setForm(f => ({ ...f, deliveryLocationId: locationId, deliveryFee: loc ? loc.fee : '', amountToPay: calculateAmount({ ...f, deliveryFee: loc ? loc.fee : '' }) }));
  };

  const handleCreate = async () => {
    try {
      const errs = {};
      if (!form.partnerName.trim()) errs.partnerName = true;
      if (!form.productName.trim()) errs.productName = true;
      if (!form.productPrice || parseFloat(form.productPrice) <= 0) errs.productPrice = true;
      if (!form.deliveryLocationId) errs.deliveryLocationId = true;
      if (Object.keys(errs).length) {
        toast.error('Veuillez remplir les champs requis');
        return;
      }

      if (selectedOrder) {
        await updateDoc(doc(db, 'partnerOrders', selectedOrder.id), {
          partnerName: form.partnerName.trim(),
          productName: form.productName.trim(),
          qty: Number(form.qty),
          productPrice: parseFloat(form.productPrice),
          deliveryLocationId: form.deliveryLocationId,
          deliveryLocationName: quartiers.find(q => q.id === form.deliveryLocationId)?.name || '',
          deliveryFee: parseFloat(form.deliveryFee) || 0,
          amountToPay: calculateAmount(form),
          updatedAt: serverTimestamp(),
        });
        toast.success('Commande partenaire mise à jour');
      } else {
        await addDoc(collection(db, 'partnerOrders'), {
          partnerName: form.partnerName.trim(),
          productName: form.productName.trim(),
          qty: Number(form.qty),
          productPrice: parseFloat(form.productPrice),
          deliveryLocationId: form.deliveryLocationId,
          deliveryLocationName: quartiers.find(q => q.id === form.deliveryLocationId)?.name || '',
          deliveryFee: parseFloat(form.deliveryFee) || 0,
          amountToPay: calculateAmount(form),
          restaurantId: currentRestaurantId,
          createdBy: auth?.currentUser?.email || 'unknown',
          createdAt: serverTimestamp(),
        });
        toast.success('Commande partenaire enregistrée');
      }

      resetForm();
      loadData();
    } catch (e) {
      console.error('Erreur create partner order', e);
      toast.error('Erreur lors de l’enregistrement');
    }
  };

  const handleEdit = (order) => {
    setSelectedOrder(order);
    setForm({
      partnerName: order.partnerName || '',
      productName: order.productName || '',
      qty: order.qty || 1,
      productPrice: order.productPrice || '',
      deliveryLocationId: order.deliveryLocationId || '',
      deliveryFee: order.deliveryFee || '',
      amountToPay: order.amountToPay || 0,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette commande partenaire ?')) return;
    try {
      await deleteDoc(doc(db, 'partnerOrders', id));
      toast.success('Commande supprimée');
      loadData();
    } catch (e) {
      console.error('Erreur suppression', e);
      toast.error('Erreur lors de la suppression');
    }
  };

  // While auth state is initializing, show a lightweight loader
  if (authUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-600">Chargement…</div>
    );
  }

  // If explicitly unauthenticated, show link to dedicated partner login page
  if (authUser === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
        <div className="bg-white p-6 rounded shadow-md w-full max-w-lg text-center">
          <h2 className="text-2xl font-semibold text-blue-700 mb-4">Service Livraisons — Partenaires</h2>
          <p className="mb-4">Cette section nécessite une connexion dédiée pour le service partenaires.</p>
          <div className="space-y-2">
            <a href="/login-partners" className="inline-block w-full bg-blue-600 text-white px-4 py-2 rounded">Se connecter (service partenaires)</a>
            <div className="text-sm text-gray-600 mt-2">Remarque: ce login est distinct du login restaurant.</div>
          </div>
        </div>
      </div>
    );
  }

  if (userRole && !ALLOWED_ROLES.includes(userRole)) {
    return <div className="p-6 bg-white rounded shadow text-center text-gray-600">Accès refusé — vous n'avez pas la permission d'accéder à ce tableau.</div>;
  }

  return (
    <div className="space-y-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-blue-700">Service Livraison Partenaires</h3>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-2"><FaPlus />Nouvelle commande</button>
        </div>
        <p className="text-sm text-blue-600 mt-2">Tableau d'enregistrement des commandes reçues des partenaires.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <div className="text-center py-8 text-blue-600">Chargement...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 text-blue-700">
                <tr>
                  <th className="px-3 py-2 text-left">Partenaire</th>
                  <th className="px-3 py-2 text-left">Produit</th>
                  <th className="px-3 py-2 text-left">Qte</th>
                  <th className="px-3 py-2 text-left">Prix unité</th>
                  <th className="px-3 py-2 text-left">Lieu</th>
                  <th className="px-3 py-2 text-left">Frais livraison</th>
                  <th className="px-3 py-2 text-left">Montant à verser</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-blue-50">
                    <td className="px-3 py-2">{o.partnerName}</td>
                    <td className="px-3 py-2">{o.productName}</td>
                    <td className="px-3 py-2">{o.qty}</td>
                    <td className="px-3 py-2">{o.productPrice?.toLocaleString?.() ?? o.productPrice} FCFA</td>
                    <td className="px-3 py-2">{o.deliveryLocationName || '-'}</td>
                    <td className="px-3 py-2">{(o.deliveryFee || 0).toLocaleString?.() ?? o.deliveryFee} FCFA</td>
                    <td className="px-3 py-2 font-semibold">{(o.amountToPay || 0).toLocaleString?.() ?? o.amountToPay} FCFA</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(o)} className="text-blue-600"><FaEdit /></button>
                        <button onClick={() => handleDelete(o.id)} className="text-red-600"><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-6 text-blue-600">Aucune commande partenaire</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="bg-white rounded-lg shadow max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-blue-700 mb-4">{selectedOrder ? 'Modifier commande partenaire' : 'Nouvelle commande partenaire'}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700">Nom du partenaire *</label>
                <input className="w-full px-3 py-2 border rounded" value={form.partnerName} onChange={e => setForm({ ...form, partnerName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Nom du produit *</label>
                <input className="w-full px-3 py-2 border rounded" value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm text-gray-700">Quantité *</label>
                <input type="number" min="1" className="w-full px-3 py-2 border rounded" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Prix unitaire (FCFA) *</label>
                <input type="number" min="0" className="w-full px-3 py-2 border rounded" value={form.productPrice} onChange={e => setForm({ ...form, productPrice: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm text-gray-700">Lieu de livraison *</label>
                <select className="w-full px-3 py-2 border rounded" value={form.deliveryLocationId} onChange={e => handleLocationChange(e.target.value)}>
                  <option value="">Sélectionner un quartier</option>
                  {quartiers.map(q => <option key={q.id} value={q.id}>{q.name} ({q.fee} FCFA)</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700">Frais de livraison (FCFA)</label>
                <input type="number" className="w-full px-3 py-2 border rounded" value={form.deliveryFee} onChange={e => setForm({ ...form, deliveryFee: e.target.value })} />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-gray-700">Montant à verser</label>
                <div className="w-full px-3 py-2 border rounded bg-blue-50 text-blue-800 font-semibold">{form.amountToPay?.toLocaleString ? form.amountToPay.toLocaleString() : form.amountToPay} FCFA</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button className="px-3 py-2 border rounded" onClick={resetForm}>Annuler</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleCreate}>{selectedOrder ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerDeliveries;
