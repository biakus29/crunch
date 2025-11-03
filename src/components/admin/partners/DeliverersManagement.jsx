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
import {
  FaMotorcycle,
  FaPlus,
  FaEdit,
  FaTrash,
  FaMoneyBillWave,
  FaChartBar,
  FaUser,
  FaPhone,
  FaCheckCircle,
  FaTimesCircle,
} from 'react-icons/fa';

const DeliverersManagement = ({ currentRestaurantId }) => {
  const [deliverers, setDeliverers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDeliverer, setSelectedDeliverer] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list, stats
  const [form, setForm] = useState({
    name: '',
    phone: '',
    vehicleType: 'moto',
    active: true,
  });

  useEffect(() => {
    loadDeliverers();
    loadExpenses();
  }, []);

  const loadDeliverers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'deliverers'), orderBy('name'));
      const snap = await getDocs(q);
      setDeliverers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erreur chargement livreurs:', e);
      toast.error('Erreur lors du chargement des livreurs');
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async () => {
    try {
      const q = query(
        collection(db, 'deliveryExpenses'),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      setExpenses(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          date: d.data().date?.toDate(),
        }))
      );
    } catch (e) {
      console.error('Erreur chargement dépenses:', e);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      vehicleType: 'moto',
      active: true,
    });
    setSelectedDeliverer(null);
    setShowModal(false);
  };

  const handleSubmit = async () => {
    try {
      if (!form.name.trim()) {
        toast.error('Le nom du livreur est obligatoire');
        return;
      }

      const delivererData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        vehicleType: form.vehicleType,
        active: form.active,
        updatedAt: serverTimestamp(),
      };

      if (selectedDeliverer) {
        await updateDoc(doc(db, 'deliverers', selectedDeliverer.id), delivererData);
        toast.success('Livreur mis à jour');
      } else {
        await addDoc(collection(db, 'deliverers'), {
          ...delivererData,
          createdAt: serverTimestamp(),
        });
        toast.success('Livreur ajouté');
      }

      resetForm();
      loadDeliverers();
    } catch (e) {
      console.error('Erreur sauvegarde:', e);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (deliverer) => {
    setSelectedDeliverer(deliverer);
    setForm({
      name: deliverer.name || '',
      phone: deliverer.phone || '',
      vehicleType: deliverer.vehicleType || 'moto',
      active: deliverer.active !== false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce livreur ? Cette action est irréversible.')) return;
    try {
      await deleteDoc(doc(db, 'deliverers', id));
      toast.success('Livreur supprimé');
      loadDeliverers();
    } catch (e) {
      console.error('Erreur suppression:', e);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleActive = async (deliverer) => {
    try {
      await updateDoc(doc(db, 'deliverers', deliverer.id), {
        active: !deliverer.active,
        updatedAt: serverTimestamp(),
      });
      toast.success('Statut mis à jour');
      loadDeliverers();
    } catch (e) {
      console.error('Erreur:', e);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Calculer les dépenses par livreur
  const getDelivererExpenses = (delivererName) => {
    return expenses.filter(
      (exp) =>
        exp.delivererName &&
        exp.delivererName.toLowerCase() === delivererName.toLowerCase()
    );
  };

  const getDelivererTotalExpenses = (delivererName) => {
    return getDelivererExpenses(delivererName).reduce(
      (sum, exp) => sum + (exp.amount || 0),
      0
    );
  };

  // Statistiques globales
  const totalDeliverers = deliverers.length;
  const activeDeliverers = deliverers.filter((d) => d.active !== false).length;
  const totalExpensesAllDeliverers = deliverers.reduce(
    (sum, d) => sum + getDelivererTotalExpenses(d.name),
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Gestion des Livreurs</h3>
          <p className="text-sm text-gray-600 mt-1">
            Gérez vos livreurs et suivez leurs dépenses
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'stats' : 'list')}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            {viewMode === 'list' ? <FaChartBar /> : <FaUser />}
            {viewMode === 'list' ? 'Stats' : 'Liste'}
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <FaPlus /> Ajouter
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FaMotorcycle className="text-blue-600" />
            <span className="text-sm text-gray-600">Total livreurs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalDeliverers}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FaCheckCircle className="text-green-600" />
            <span className="text-sm text-gray-600">Actifs</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{activeDeliverers}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <FaMoneyBillWave className="text-orange-600" />
            <span className="text-sm text-gray-600">Dépenses totales</span>
          </div>
          <p className="text-2xl font-bold text-orange-700">
            {totalExpensesAllDeliverers.toLocaleString()} FCFA
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-8 text-blue-600">Chargement...</div>
      ) : viewMode === 'list' ? (
        /* Liste des livreurs */
        <div className="space-y-3">
          {/* Mobile Cards */}
          <div className="block lg:hidden space-y-3">
            {deliverers.map((deliverer) => {
              const delivererExpenses = getDelivererExpenses(deliverer.name);
              const totalExpenses = getDelivererTotalExpenses(deliverer.name);

              return (
                <div
                  key={deliverer.id}
                  className="bg-white border rounded-lg p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <FaMotorcycle className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{deliverer.name}</h4>
                        {deliverer.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                            <FaPhone className="w-3 h-3" />
                            {deliverer.phone}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {deliverer.vehicleType || 'Moto'}
                          </span>
                          <button
                            onClick={() => toggleActive(deliverer)}
                            className={`text-xs px-2 py-1 rounded font-medium ${
                              deliverer.active !== false
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {deliverer.active !== false ? 'Actif' : 'Inactif'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(deliverer)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(deliverer.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  {/* Dépenses */}
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-orange-900">
                        Dépenses associées
                      </span>
                      <span className="text-lg font-bold text-orange-700">
                        {totalExpenses.toLocaleString()} FCFA
                      </span>
                    </div>
                    {delivererExpenses.length > 0 ? (
                      <div className="space-y-1">
                        {delivererExpenses.slice(0, 3).map((exp) => (
                          <div
                            key={exp.id}
                            className="flex justify-between text-xs text-orange-800"
                          >
                            <span>
                              {exp.type === 'fuel'
                                ? '⛽ Carburant'
                                : exp.type === 'maintenance'
                                ? '🔧 Entretien'
                                : exp.type === 'salary'
                                ? '💰 Salaire'
                                : '📄 Autre'}
                            </span>
                            <span className="font-medium">
                              {exp.amount?.toLocaleString()} FCFA
                            </span>
                          </div>
                        ))}
                        {delivererExpenses.length > 3 && (
                          <p className="text-xs text-orange-600 text-center mt-1">
                            +{delivererExpenses.length - 3} autre(s)
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-orange-600 text-center">
                        Aucune dépense enregistrée
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm bg-white rounded-lg overflow-hidden">
              <thead className="bg-blue-50 text-blue-700">
                <tr>
                  <th className="px-4 py-3 text-left">Livreur</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Véhicule</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Dépenses</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliverers.map((deliverer) => {
                  const delivererExpenses = getDelivererExpenses(deliverer.name);
                  const totalExpenses = getDelivererTotalExpenses(deliverer.name);

                  return (
                    <tr key={deliverer.id} className="hover:bg-blue-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FaMotorcycle className="text-blue-600" />
                          <span className="font-medium">{deliverer.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {deliverer.phone || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {deliverer.vehicleType || 'Moto'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(deliverer)}
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            deliverer.active !== false
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {deliverer.active !== false ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-bold text-orange-700">
                            {totalExpenses.toLocaleString()} FCFA
                          </span>
                          <p className="text-xs text-gray-500">
                            {delivererExpenses.length} dépense(s)
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(deliverer)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(deliverer.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {deliverers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <FaMotorcycle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucun livreur. Ajoutez-en un pour commencer.</p>
            </div>
          )}
        </div>
      ) : (
        /* Vue Statistiques */
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-4">
              Classement par dépenses
            </h4>
            <div className="space-y-3">
              {deliverers
                .map((d) => ({
                  ...d,
                  totalExpenses: getDelivererTotalExpenses(d.name),
                  expensesCount: getDelivererExpenses(d.name).length,
                }))
                .sort((a, b) => b.totalExpenses - a.totalExpenses)
                .map((deliverer, index) => (
                  <div
                    key={deliverer.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {deliverer.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {deliverer.expensesCount} dépense(s)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-700">
                        {deliverer.totalExpenses.toLocaleString()} FCFA
                      </div>
                      <div className="text-xs text-gray-500">
                        {totalExpensesAllDeliverers > 0
                          ? Math.round(
                              (deliverer.totalExpenses / totalExpensesAllDeliverers) *
                                100
                            )
                          : 0}
                        % du total
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
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
              {selectedDeliverer ? 'Modifier le livreur' : 'Nouveau livreur'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet *
                </label>
                <input
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+237 6XX XXX XXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de véhicule
                </label>
                <select
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.vehicleType}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                >
                  <option value="moto">Moto</option>
                  <option value="scooter">Scooter</option>
                  <option value="velo">Vélo</option>
                  <option value="voiture">Voiture</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Livreur actif</span>
                </label>
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
                {selectedDeliverer ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliverersManagement;
