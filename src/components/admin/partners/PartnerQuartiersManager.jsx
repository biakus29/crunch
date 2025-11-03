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
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';

const PartnerQuartiersManager = () => {
  const [quartiers, setQuartiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    fee: 0,
    partnerDeliveryFee: 0,
  });

  useEffect(() => {
    loadQuartiers();
  }, []);

  const loadQuartiers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'quartiers'), orderBy('name'));
      const snap = await getDocs(q);
      setQuartiers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erreur chargement quartiers:', e);
      toast.error('Erreur lors du chargement des quartiers');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      fee: 0,
      partnerDeliveryFee: 0,
    });
    setEditingId(null);
    setShowModal(false);
  };

  const handleSubmit = async () => {
    try {
      if (!form.name.trim()) {
        toast.error('Le nom du quartier est obligatoire');
        return;
      }

      if (form.fee < 0 || form.partnerDeliveryFee < 0) {
        toast.error('Les frais doivent être positifs');
        return;
      }

      const quartierData = {
        name: form.name.trim(),
        fee: Number(form.fee),
        partnerDeliveryFee: Number(form.partnerDeliveryFee),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'quartiers', editingId), quartierData);
        toast.success('Quartier mis à jour avec succès');
      } else {
        await addDoc(collection(db, 'quartiers'), {
          ...quartierData,
          createdAt: serverTimestamp(),
        });
        toast.success('Quartier ajouté avec succès');
      }

      resetForm();
      loadQuartiers();
    } catch (e) {
      console.error('Erreur sauvegarde quartier:', e);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (quartier) => {
    setEditingId(quartier.id);
    setForm({
      name: quartier.name || '',
      fee: quartier.fee || 0,
      partnerDeliveryFee: quartier.partnerDeliveryFee || quartier.fee || 0,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce quartier ? Cette action est irréversible.')) return;
    try {
      await deleteDoc(doc(db, 'quartiers', id));
      toast.success('Quartier supprimé');
      loadQuartiers();
    } catch (e) {
      console.error('Erreur suppression:', e);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleQuickEdit = async (quartierId, field, value) => {
    try {
      await updateDoc(doc(db, 'quartiers', quartierId), {
        [field]: Number(value),
        updatedAt: serverTimestamp(),
      });
      toast.success('Mis à jour');
      loadQuartiers();
    } catch (e) {
      console.error('Erreur mise à jour:', e);
      toast.error('Erreur');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Gestion des Quartiers</h3>
          <p className="text-sm text-gray-600 mt-1">
            Ajoutez et gérez les quartiers de livraison
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 w-full sm:w-auto justify-center"
        >
          <FaPlus /> Nouveau Quartier
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FaMapMarkerAlt className="text-blue-600 mt-1 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-1">À propos des frais de livraison</p>
            <ul className="space-y-1">
              <li>• <strong>Frais standard</strong> : utilisés pour les commandes restaurant</li>
              <li>• <strong>Frais partenaires</strong> : utilisés pour les commandes partenaires</li>
              <li>• Si les frais partenaires ne sont pas définis, les frais standard seront utilisés</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quartiers List */}
      {loading ? (
        <div className="text-center py-8 text-blue-600">Chargement...</div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Cards */}
          <div className="block lg:hidden space-y-3">
            {quartiers.map((quartier) => (
              <div key={quartier.id} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt className="text-blue-600" />
                    <h4 className="font-semibold text-gray-900">{quartier.name}</h4>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(quartier)}
                      className="text-blue-600 hover:text-blue-800 p-2"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(quartier.id)}
                      className="text-red-600 hover:text-red-800 p-2"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Frais standard:</span>
                    <span className="font-semibold">{quartier.fee?.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Frais partenaires:</span>
                    <span className="font-semibold text-blue-700">
                      {(quartier.partnerDeliveryFee || quartier.fee)?.toLocaleString()} FCFA
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 text-blue-700">
                <tr>
                  <th className="px-4 py-3 text-left">Quartier</th>
                  <th className="px-4 py-3 text-left">Frais standard (FCFA)</th>
                  <th className="px-4 py-3 text-left">Frais partenaires (FCFA)</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {quartiers.map((quartier) => (
                  <tr key={quartier.id} className="hover:bg-blue-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FaMapMarkerAlt className="text-gray-400" />
                        <span className="font-medium">{quartier.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {quartier.fee?.toLocaleString()} FCFA
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-blue-700">
                        {(quartier.partnerDeliveryFee || quartier.fee)?.toLocaleString()} FCFA
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(quartier)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Modifier"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(quartier.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Supprimer"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {quartiers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <FaMapMarkerAlt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucun quartier. Ajoutez-en un pour commencer.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
          onClick={resetForm}
        >
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-blue-700 mb-4">
              {editingId ? 'Modifier le quartier' : 'Nouveau quartier'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du quartier *
                </label>
                <input
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Bastos, Mvan..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frais standard (FCFA) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.fee}
                  onChange={(e) => setForm({ ...form, fee: e.target.value })}
                  placeholder="1000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Utilisé pour les commandes restaurant
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frais partenaires (FCFA) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.partnerDeliveryFee}
                  onChange={(e) => setForm({ ...form, partnerDeliveryFee: e.target.value })}
                  placeholder="1500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Utilisé pour les commandes partenaires
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                onClick={resetForm}
              >
                Annuler
              </button>
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleSubmit}
              >
                {editingId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerQuartiersManager;
