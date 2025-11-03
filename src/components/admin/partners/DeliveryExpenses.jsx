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
import { FaPlus, FaEdit, FaTrash, FaMoneyBillWave, FaGasPump, FaTools, FaReceipt } from 'react-icons/fa';

const EXPENSE_TYPES = {
  fuel: { label: 'Carburant', icon: FaGasPump, color: 'text-orange-600' },
  maintenance: { label: 'Entretien', icon: FaTools, color: 'text-blue-600' },
  salary: { label: 'Salaire livreur', icon: FaMoneyBillWave, color: 'text-green-600' },
  other: { label: 'Autre', icon: FaReceipt, color: 'text-gray-600' },
};

const DeliveryExpenses = ({ currentRestaurantId }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [dateFilter, setDateFilter] = useState('month'); // today, week, month, all
  const [form, setForm] = useState({
    type: 'fuel',
    amount: '',
    delivererName: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (currentRestaurantId) {
      loadExpenses();
    }
  }, [currentRestaurantId, dateFilter]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'deliveryExpenses'),
        where('restaurantId', '==', currentRestaurantId),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      let allExpenses = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate(),
      }));

      const filterDate = getDateFilter();
      if (filterDate) {
        allExpenses = allExpenses.filter((exp) => exp.date >= filterDate);
      }

      setExpenses(allExpenses);
    } catch (e) {
      console.error('Erreur chargement dépenses:', e);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      type: 'fuel',
      amount: '',
      delivererName: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
    setSelectedExpense(null);
    setShowModal(false);
  };

  const handleSubmit = async () => {
    try {
      if (!form.amount || form.amount <= 0) {
        toast.error('Le montant doit être supérieur à 0');
        return;
      }

      const expenseData = {
        type: form.type,
        amount: Number(form.amount),
        delivererName: form.delivererName.trim(),
        description: form.description.trim(),
        date: new Date(form.date),
        restaurantId: currentRestaurantId,
        updatedAt: serverTimestamp(),
      };

      if (selectedExpense) {
        await updateDoc(doc(db, 'deliveryExpenses', selectedExpense.id), expenseData);
        toast.success('Dépense mise à jour');
      } else {
        await addDoc(collection(db, 'deliveryExpenses'), {
          ...expenseData,
          createdAt: serverTimestamp(),
        });
        toast.success('Dépense enregistrée');
      }

      resetForm();
      loadExpenses();
    } catch (e) {
      console.error('Erreur sauvegarde:', e);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (expense) => {
    setSelectedExpense(expense);
    setForm({
      type: expense.type || 'fuel',
      amount: expense.amount || '',
      delivererName: expense.delivererName || '',
      description: expense.description || '',
      date: expense.date ? expense.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette dépense ?')) return;
    try {
      await deleteDoc(doc(db, 'deliveryExpenses', id));
      toast.success('Dépense supprimée');
      loadExpenses();
    } catch (e) {
      console.error('Erreur suppression:', e);
      toast.error('Erreur lors de la suppression');
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const expensesByType = Object.keys(EXPENSE_TYPES).reduce((acc, type) => {
    acc[type] = expenses.filter((e) => e.type === type).reduce((sum, e) => sum + (e.amount || 0), 0);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Dépenses de Livraison</h3>
          <p className="text-sm text-gray-600 mt-1">Gérez vos dépenses de livraison</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-none"
          >
            <option value="today">Aujourd'hui</option>
            <option value="week">7 jours</option>
            <option value="month">30 jours</option>
            <option value="all">Tout</option>
          </select>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <FaPlus className="hidden sm:inline" /> Ajouter
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4 shadow-lg col-span-2 lg:col-span-1">
          <p className="text-sm opacity-90 mb-1">Total dépenses</p>
          <p className="text-2xl font-bold">{totalExpenses.toLocaleString()}</p>
          <p className="text-xs opacity-75">FCFA</p>
        </div>
        {Object.entries(EXPENSE_TYPES).map(([type, config]) => {
          const Icon = config.icon;
          return (
            <div key={type} className="bg-white border rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className="text-xs text-gray-600">{config.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {expensesByType[type]?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-gray-500">FCFA</p>
            </div>
          );
        })}
      </div>

      {/* Expenses List */}
      {loading ? (
        <div className="text-center py-8 text-blue-600">Chargement...</div>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => {
            const config = EXPENSE_TYPES[expense.type] || EXPENSE_TYPES.other;
            const Icon = config.icon;

            return (
              <div
                key={expense.id}
                className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg bg-gray-50`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{config.label}</h4>
                        {expense.delivererName && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {expense.delivererName}
                          </span>
                        )}
                      </div>
                      {expense.description && (
                        <p className="text-sm text-gray-600 mb-1">{expense.description}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        {expense.date?.toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {expense.amount?.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">FCFA</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {expenses.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border">
              <FaMoneyBillWave className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucune dépense enregistrée</p>
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
              {selectedExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {Object.entries(EXPENSE_TYPES).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant (FCFA) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="5000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Livreur (optionnel)
                </label>
                <input
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  value={form.delivererName}
                  onChange={(e) => setForm({ ...form, delivererName: e.target.value })}
                  placeholder="Nom du livreur"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optionnel)
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Détails de la dépense..."
                />
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
                {selectedExpense ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryExpenses;
