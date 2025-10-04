import React, { useEffect, useState } from 'react';
import { db, auth } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { FaUserTie, FaEdit, FaTrash, FaPlus, FaBoxes } from 'react-icons/fa';

const ManagerManager = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [supplyManagers, setSupplyManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateSupply, setShowCreateSupply] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    name: '',
    adresse: '',
    city: '',
    contact: '',
    email: '',
    password: ''
  });
  const [supplyForm, setSupplyForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    restaurantId: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [restaurantsSnap, supplySnap] = await Promise.all([
          getDocs(collection(db, 'restaurants')),
          getDocs(collection(db, 'supplyManagers'))
        ]);
        
        setRestaurants(restaurantsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSupplyManagers(supplySnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Erreur chargement', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const resetForm = () => setForm({ name: '', adresse: '', city: '', contact: '', email: '', password: '' });
  const resetSupplyForm = () => setSupplyForm({ name: '', email: '', password: '', phone: '', restaurantId: '' });

  const createManager = async () => {
    try {
      if (!form.email || !form.password || !form.name) {
        alert('Email, mot de passe et nom du restaurant sont requis');
        return;
      }
      // Créer le compte Auth du manager
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const uid = cred.user.uid;
      // Créer le document restaurant lié
      const restaurantData = {
        name: form.name,
        adresse: form.adresse || '',
        city: form.city || '',
        contact: form.contact || '',
        uid,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, 'restaurants'), restaurantData);
      // Créer/mettre à jour le profil utilisateur côté usersrestau
      await setDoc(doc(db, 'usersrestau', uid), {
        email: form.email.trim(),
        role: 'manager',
        name: form.name,
        phone: form.contact || '',
        points: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      setRestaurants(prev => [...prev, { id: ref.id, ...restaurantData }]);
      setShowCreate(false);
      resetForm();
      alert(`Manager et restaurant créés avec succès. URL d'accès: /admin-restaurant/${ref.id}`);
    } catch (e) {
      console.error('Erreur création manager', e);
      alert(`Erreur: ${e.message}`);
    }
  };

  const createSupplyManager = async () => {
    try {
      if (!supplyForm.email || !supplyForm.password || !supplyForm.name || !supplyForm.restaurantId) {
        alert('Tous les champs sont requis');
        return;
      }
      // Créer le compte Auth
      const cred = await createUserWithEmailAndPassword(auth, supplyForm.email.trim(), supplyForm.password);
      const uid = cred.user.uid;
      
      // Créer le document supply manager
      const supplyData = {
        name: supplyForm.name,
        email: supplyForm.email.trim(),
        phone: supplyForm.phone || '',
        restaurantId: supplyForm.restaurantId,
        uid,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, 'supplyManagers'), supplyData);
      
      // Créer le profil utilisateur
      await setDoc(doc(db, 'usersrestau', uid), {
        email: supplyForm.email.trim(),
        role: 'supply_manager',
        name: supplyForm.name,
        phone: supplyForm.phone || '',
        points: 0,
        restaurantId: supplyForm.restaurantId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setSupplyManagers(prev => [...prev, { id: ref.id, ...supplyData }]);
      setShowCreateSupply(false);
      resetSupplyForm();
      alert(`Gestionnaire des approvisionnements créé avec succès. URL d'accès: /supply-manager`);
    } catch (e) {
      console.error('Erreur création gestionnaire', e);
      alert(`Erreur: ${e.message}`);
    }
  };

  const openEdit = (r) => {
    setSelected(r);
    setForm({
      name: r.name || '',
      adresse: r.adresse || '',
      city: r.city || '',
      contact: r.contact || '',
      email: r.email || '',
      password: ''
    });
    setShowEdit(true);
  };

  const updateManager = async () => {
    try {
      if (!selected) return;
      await updateDoc(doc(db, 'restaurants', selected.id), {
        name: form.name,
        adresse: form.adresse,
        city: form.city,
        contact: form.contact,
        updatedAt: serverTimestamp()
      });
      setRestaurants(prev => prev.map(r => r.id === selected.id ? { ...r, name: form.name, adresse: form.adresse, city: form.city, contact: form.contact } : r));
      setShowEdit(false);
      setSelected(null);
      alert('Restaurant mis à jour');
    } catch (e) {
      console.error('Erreur mise à jour', e);
      alert(`Erreur: ${e.message}`);
    }
  };

  const deleteManager = async (id) => {
    if (!window.confirm('Supprimer ce restaurant/manager ?')) return;
    try {
      await deleteDoc(doc(db, 'restaurants', id));
      setRestaurants(prev => prev.filter(r => r.id !== id));
      alert('Restaurant supprimé');
    } catch (e) {
      console.error('Erreur suppression', e);
      alert(`Erreur: ${e.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">Chargement des managers...</div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold flex items-center gap-2"><FaUserTie /> Gestion des Managers</h3>
        <button onClick={() => { resetForm(); setShowCreate(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
          <FaPlus /> Nouveau Manager
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Restaurant</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ville</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {restaurants.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{r.city || '-'}</td>
                <td className="px-4 py-2">{r.contact || '-'}</td>
                <td className="px-4 py-2 space-x-2">
                  <button onClick={() => openEdit(r)} className="text-indigo-600"><FaEdit /></button>
                  <button onClick={() => deleteManager(r.id)} className="text-red-600"><FaTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Création */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-4">Créer un Manager</h4>
            <div className="space-y-3">
              <input className="w-full px-3 py-2 border rounded" placeholder="Nom du restaurant" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Adresse" value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Ville" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Contact" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Email (manager)" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Mot de passe" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2">Annuler</button>
              <button onClick={createManager} className="px-4 py-2 bg-blue-600 text-white rounded">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Édition */}
      {showEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-4">Modifier le Restaurant</h4>
            <div className="space-y-3">
              <input className="w-full px-3 py-2 border rounded" placeholder="Nom du restaurant" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Adresse" value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Ville" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <input className="w-full px-3 py-2 border rounded" placeholder="Contact" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowEdit(false); setSelected(null); }} className="px-4 py-2">Annuler</button>
              <button onClick={updateManager} className="px-4 py-2 bg-indigo-600 text-white rounded">Mettre à jour</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerManager;
