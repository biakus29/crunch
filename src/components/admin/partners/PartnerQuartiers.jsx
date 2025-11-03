import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaEdit, FaSave, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';

const PartnerQuartiers = () => {
  const [quartiers, setQuartiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
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

  const handleEdit = (quartier) => {
    setEditingId(quartier.id);
    setEditForm({
      partnerDeliveryFee: quartier.partnerDeliveryFee || quartier.fee || 0,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({ partnerDeliveryFee: 0 });
  };

  const handleSave = async (quartierId) => {
    try {
      if (editForm.partnerDeliveryFee < 0) {
        toast.error('Les frais de livraison doivent être positifs');
        return;
      }

      await updateDoc(doc(db, 'quartiers', quartierId), {
        partnerDeliveryFee: Number(editForm.partnerDeliveryFee),
        updatedAt: serverTimestamp(),
      });

      toast.success('Frais de livraison mis à jour');
      setEditingId(null);
      loadQuartiers();
    } catch (e) {
      console.error('Erreur mise à jour:', e);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FaMapMarkerAlt className="text-blue-600 mt-1" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">
              Gestion des frais de livraison partenaires
            </h4>
            <p className="text-sm text-blue-700">
              Les quartiers sont les mêmes que ceux du restaurant, mais vous pouvez définir des
              frais de livraison différents pour le service partenaires. Si aucun frais spécifique
              n'est défini, les frais standards du restaurant seront utilisés.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-blue-600">Chargement...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-blue-700">
              <tr>
                <th className="px-4 py-3 text-left">Quartier</th>
                <th className="px-4 py-3 text-left">Frais standard (FCFA)</th>
                <th className="px-4 py-3 text-left">Frais partenaires (FCFA)</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
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
                    {editingId === quartier.id ? (
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={editForm.partnerDeliveryFee}
                        onChange={(e) =>
                          setEditForm({ partnerDeliveryFee: e.target.value })
                        }
                        className="w-32 px-3 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-blue-700">
                        {(quartier.partnerDeliveryFee || quartier.fee)?.toLocaleString()} FCFA
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === quartier.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(quartier.id)}
                          className="text-green-600 hover:text-green-800"
                          title="Enregistrer"
                        >
                          <FaSave />
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-red-600 hover:text-red-800"
                          title="Annuler"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(quartier)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Modifier"
                      >
                        <FaEdit />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {quartiers.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    Aucun quartier trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">💡 Astuce</h4>
        <p className="text-sm text-gray-600">
          Pour ajouter de nouveaux quartiers, utilisez la section "Gestion des quartiers" dans le
          menu principal du restaurant. Les quartiers ajoutés apparaîtront automatiquement ici.
        </p>
      </div>
    </div>
  );
};

export default PartnerQuartiers;
