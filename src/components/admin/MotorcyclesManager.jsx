import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
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
import { FaMotorcycle, FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';

const MotorcyclesManager = ({ currentRestaurantId }) => {
  const [motorcycles, setMotorcycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deliverers, setDeliverers] = useState([]);

  const [form, setForm] = useState({
    brand: '',
    registrationNumber: '',
    purchaseDate: '',
    currentDelivererId: '',
    active: true,
  });

  useEffect(() => {
    if (!currentRestaurantId) return;
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const motosQuery = query(
        collection(db, 'motorcycles'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('brand')
      );
      const motosSnap = await getDocs(motosQuery);
      setMotorcycles(motosSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const delivSnap = await getDocs(query(collection(db, 'deliverers'), where('restaurantId', '==', currentRestaurantId), orderBy('name')));
      setDeliverers(delivSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement motos:', error);
      toast.error('Erreur lors du chargement des motos');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ brand: '', registrationNumber: '', purchaseDate: '', currentDelivererId: '', active: true });
    setSelected(null);
    setShowModal(false);
  };

  const handleEdit = (moto) => {
    setSelected(moto);
    // normalize date to YYYY-MM-DD if timestamp
    const purchaseDate = moto.purchaseDate
      ? (typeof moto.purchaseDate.toDate === 'function' ? moto.purchaseDate.toDate().toISOString().slice(0,10) : (typeof moto.purchaseDate === 'string' ? moto.purchaseDate : ''))
      : '';
    setForm({ brand: moto.brand || '', registrationNumber: moto.registrationNumber || '', purchaseDate, currentDelivererId: moto.currentDelivererId || '', active: moto.active !== false });
    setShowModal(true);
  };

  const createMoto = async () => {
    await addDoc(collection(db, 'motorcycles'), {
      ...form,
      restaurantId: currentRestaurantId,
      createdAt: serverTimestamp(),
    });
    toast.success('Moto créée');
    resetForm();
    loadData();
  };

  const updateMoto = async () => {
    await updateDoc(doc(db, 'motorcycles', selected.id), {
      ...form,
      updatedAt: serverTimestamp(),
    });
    toast.success('Moto mise à jour');
    resetForm();
    loadData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette moto ?')) return;
    try {
      await deleteDoc(doc(db, 'motorcycles', id));
      toast.success('Moto supprimée');
      loadData();
    } catch (error) {
      console.error('Erreur suppression moto:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 flex items-center gap-2"><FaMotorcycle /> Motos ({motorcycles.length})</h4>
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => { resetForm(); setShowModal(true); }}><FaPlus /> Nouveau</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Marque</th>
              <th className="px-3 py-2 text-left">Immatriculation</th>
              <th className="px-3 py-2 text-left">Date d'achat</th>
              <th className="px-3 py-2 text-left">Livreur actuel</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {motorcycles.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">{m.brand || '-'}</td>
                <td className="px-3 py-2">{m.registrationNumber || '-'}</td>
                <td className="px-3 py-2">{m.purchaseDate ? (typeof m.purchaseDate.toDate === 'function' ? m.purchaseDate.toDate().toLocaleDateString() : new Date(m.purchaseDate).toLocaleDateString()) : '-'}</td>
                <td className="px-3 py-2">{m.currentDelivererId ? (deliverers.find(d => d.id === m.currentDelivererId)?.name || '-') : '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(m)} className="text-blue-600"><FaEdit /></button>
                    <button onClick={() => handleDelete(m.id)} className="text-red-600"><FaTrash /></button>
                  </div>
                </td>
              </tr>
            ))}
            {motorcycles.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-gray-500">Aucune moto</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="bg-white rounded-lg max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{selected ? 'Modifier moto' : 'Nouvelle moto'}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700">Marque</label>
                <input className="w-full px-3 py-2 border rounded" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Immatriculation</label>
                <input className="w-full px-3 py-2 border rounded" value={form.registrationNumber} onChange={e => setForm({...form, registrationNumber: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Date d'achat</label>
                <input type="date" className="w-full px-3 py-2 border rounded" value={form.purchaseDate} onChange={e => setForm({...form, purchaseDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Livreur actuel</label>
                <select className="w-full px-3 py-2 border rounded" value={form.currentDelivererId} onChange={e => setForm({...form, currentDelivererId: e.target.value})}>
                  <option value="">Aucun</option>
                  {deliverers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button className="px-3 py-2 border rounded" onClick={resetForm}>Annuler</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={selected ? updateMoto : createMoto}>{selected ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MotorcyclesManager;
