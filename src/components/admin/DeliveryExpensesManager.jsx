import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
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
  Timestamp,
} from 'firebase/firestore';
import {
  FaGasPump,
  FaWrench,
  FaTools,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaUser,
  FaFileInvoice,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const EXPENSE_CATEGORIES = [
  { value: 'fuel', label: '⛽ Carburant', icon: FaGasPump, color: 'orange' },
  { value: 'maintenance', label: '🔧 Entretien', icon: FaWrench, color: 'blue' },
  { value: 'repair', label: '🛠️ Réparation/Panne', icon: FaTools, color: 'red' },
  { value: 'other', label: '📦 Divers', icon: FaFileInvoice, color: 'purple' },
];

const DeliveryExpensesManager = ({ currentRestaurantId, userRole }) => {
  const [expenses, setExpenses] = useState([]);
  const [deliverers, setDeliverers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDeliverer, setFilterDeliverer] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    delivererId: '',
    delivererName: '',
    category: 'fuel',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    supplier: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger les livreurs - Si comptable (currentRestaurantId null), charger tous les livreurs
      let deliverersQuery;
      if (currentRestaurantId) {
        deliverersQuery = query(
          collection(db, 'deliverers'),
          where('restaurantId', '==', currentRestaurantId)
        );
      } else {
        deliverersQuery = collection(db, 'deliverers');
      }
      const deliverersSnap = await getDocs(deliverersQuery);
      const deliverersData = deliverersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDeliverers(deliverersData);

      // Charger les dépenses - Si comptable (currentRestaurantId null), charger toutes les dépenses
      let expensesQuery;
      if (currentRestaurantId) {
        expensesQuery = query(
          collection(db, 'deliveryExpenses'),
          where('restaurantId', '==', currentRestaurantId)
        );
      } else {
        expensesQuery = collection(db, 'deliveryExpenses');
      }
      const expensesSnap = await getDocs(expensesQuery);
      const expensesData = expensesSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateB - dateA;
        });
      setExpenses(expensesData);

      // Charger les restaurants si comptable (pour afficher les noms)
      if (!currentRestaurantId) {
        const restaurantsSnap = await getDocs(collection(db, 'restaurants'));
        const restaurantsData = restaurantsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRestaurants(restaurantsData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
      setLoading(false);
    }
  };

  const handleCreateExpense = async () => {
    try {
      const newErrors = {};
      if (!expenseForm.delivererId) newErrors.delivererId = true;
      if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) newErrors.amount = true;
      if (!expenseForm.description.trim()) newErrors.description = true;
      if (!expenseForm.date) newErrors.date = true;

      setErrors(newErrors);
      if (Object.keys(newErrors).length) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      setIsSubmitting(true);

      const deliverer = deliverers.find((d) => d.id === expenseForm.delivererId);
      const expenseData = {
        ...expenseForm,
        delivererName: deliverer?.name || '',
        amount: parseFloat(expenseForm.amount),
        date: Timestamp.fromDate(new Date(expenseForm.date)),
        restaurantId: currentRestaurantId,
        createdAt: serverTimestamp(),
      };

      if (selectedExpense) {
        await updateDoc(doc(db, 'deliveryExpenses', selectedExpense.id), {
          ...expenseData,
          updatedAt: serverTimestamp(),
        });
        toast.success('Dépense modifiée avec succès');
      } else {
        await addDoc(collection(db, 'deliveryExpenses'), expenseData);
        toast.success('Dépense enregistrée avec succès');
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditExpense = (expense) => {
    setSelectedExpense(expense);
    setExpenseForm({
      delivererId: expense.delivererId,
      delivererName: expense.delivererName,
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description,
      date: expense.date?.toDate
        ? expense.date.toDate().toISOString().split('T')[0]
        : expense.date,
      invoiceNumber: expense.invoiceNumber || '',
      supplier: expense.supplier || '',
      notes: expense.notes || '',
    });
    setShowModal(true);
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) return;

    try {
      await deleteDoc(doc(db, 'deliveryExpenses', expenseId));
      toast.success('Dépense supprimée avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setExpenseForm({
      delivererId: '',
      delivererName: '',
      category: 'fuel',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: '',
      supplier: '',
      notes: '',
    });
    setSelectedExpense(null);
    setShowModal(false);
    setErrors({});
  };

  // Filtrage des dépenses
  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.delivererName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.supplier?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === 'all' || expense.category === filterCategory;
    const matchesDeliverer = filterDeliverer === 'all' || expense.delivererId === filterDeliverer;

    let matchesDate = true;
    if (startDate && endDate) {
      const expenseDate = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = expenseDate >= start && expenseDate <= end;
    }

    return matchesSearch && matchesCategory && matchesDeliverer && matchesDate;
  });

  // Statistiques
  const stats = {
    total: filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    fuel: filteredExpenses.filter((e) => e.category === 'fuel').reduce((sum, e) => sum + e.amount, 0),
    maintenance: filteredExpenses
      .filter((e) => e.category === 'maintenance')
      .reduce((sum, e) => sum + e.amount, 0),
    repair: filteredExpenses.filter((e) => e.category === 'repair').reduce((sum, e) => sum + e.amount, 0),
    other: filteredExpenses.filter((e) => e.category === 'other').reduce((sum, e) => sum + e.amount, 0),
    count: filteredExpenses.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Dépenses</p>
              <p className="text-xl font-bold text-gray-900">{stats.total.toLocaleString()} FCFA</p>
            </div>
            <FaMoneyBillWave className="text-3xl text-gray-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Carburant</p>
              <p className="text-xl font-bold text-orange-600">{stats.fuel.toLocaleString()} FCFA</p>
            </div>
            <FaGasPump className="text-3xl text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Entretien</p>
              <p className="text-xl font-bold text-blue-600">{stats.maintenance.toLocaleString()} FCFA</p>
            </div>
            <FaWrench className="text-3xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Réparations</p>
              <p className="text-xl font-bold text-red-600">{stats.repair.toLocaleString()} FCFA</p>
            </div>
            <FaTools className="text-3xl text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Divers</p>
              <p className="text-xl font-bold text-purple-600">{stats.other.toLocaleString()} FCFA</p>
            </div>
            <FaFileInvoice className="text-3xl text-purple-500" />
          </div>
        </div>
      </div>

      {/* Actions et filtres */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center"
            >
              <FaPlus className="mr-2" /> Nouvelle Dépense
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes catégories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <select
              value={filterDeliverer}
              onChange={(e) => setFilterDeliverer(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les livreurs</option>
              {deliverers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Date début"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Date fin"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Liste des dépenses */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h4 className="font-semibold text-gray-800">
            Dépenses de Livraison ({filteredExpenses.length})
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                {!currentRestaurantId && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Restaurant</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Livreur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fournisseur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExpenses.map((expense) => {
                const category = EXPENSE_CATEGORIES.find((c) => c.value === expense.category);
                return (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {expense.date?.toDate
                        ? expense.date.toDate().toLocaleDateString('fr-FR')
                        : new Date(expense.date).toLocaleDateString('fr-FR')}
                    </td>
                    {!currentRestaurantId && (
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {restaurants.find((r) => r.id === expense.restaurantId)?.name || 'N/A'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <FaUser className="text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">{expense.delivererName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${category?.color}-100 text-${category?.color}-800`}
                      >
                        {category?.label || expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{expense.description}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      {expense.amount.toLocaleString()} FCFA
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{expense.supplier || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditExpense(expense)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <FaEdit />
                        </button>
                        {userRole === 'manager' && (
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredExpenses.length === 0 && (
            <div className="text-center py-8">
              <FaMoneyBillWave className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">Aucune dépense trouvée</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Création/Édition */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={resetForm}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  {selectedExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Livreur *</label>
                      <select
                        value={expenseForm.delivererId}
                        onChange={(e) =>
                          setExpenseForm({ ...expenseForm, delivererId: e.target.value })
                        }
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.delivererId ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Sélectionner un livreur</option>
                        {deliverers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                      <select
                        value={expenseForm.category}
                        onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA) *</label>
                      <input
                        type="number"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.amount ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Ex: 5000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.date ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                    <input
                      type="text"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.description ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Plein d'essence"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                      <input
                        type="text"
                        value={expenseForm.supplier}
                        onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Station Total"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">N° Facture</label>
                      <input
                        type="text"
                        value={expenseForm.invoiceNumber}
                        onChange={(e) =>
                          setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: FAC-2024-123"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={expenseForm.notes}
                      onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Informations complémentaires..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateExpense}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enregistrement...' : selectedExpense ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeliveryExpensesManager;
