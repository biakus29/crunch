import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { formatPrice } from '../../utils/adminUtils';

const BudgetManager = ({ orders = [], userRole }) => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);

  // Formulaire simplifié avec départements et compte de prélèvement
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    department: '',
    withdrawalAccount: ''
  });

  // État pour les montants réels en caisse par département
  const [realBalances, setRealBalances] = useState({
    'magedabord': 0,
    'crunch': 0,
    'square': 0,
    'divers': 0
  });
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [editingBalance, setEditingBalance] = useState(null);

  // Départements du système
  const DEPARTMENTS = {
    'magedabord': {
      label: '🍽️ Maged\'Abord',
      description: 'Restaurant  - Plats traditionnels',
      color: '#EF4444',
      icon: '🍽️'
    },
    'crunch': {
      label: '🥪 Crunch',
      description: 'Restaurant  -  poulet braisé et pané',
      color: '#F59E0B',
      icon: '🥪'
    },
    'square': {
      label: '🏪 Square',
      description: 'Service de livraison et logistique',
      color: '#8B5CF6',
      icon: '🏪'
    },
    'divers': {
      label: '📦 Divers',
      description: 'Dépenses générales et administratives',
      color: '#6B7280',
      icon: '📦'
    }
  };

  // Comptes bancaires disponibles pour les prélèvements
  const WITHDRAWAL_ACCOUNTS = {
    'orange_money': {
      label: '🟠 Orange Money',
      description: 'Mobile Money Orange',
      color: '#FF6B35'
    },
    'mtn_mobile_money': {
      label: '🟡 MTN Mobile Money',
      description: 'Mobile Money MTN',
      color: '#FFD23F'
    },
    'bank_transfer': {
      label: '🏦 Virement Bancaire',
      description: 'Compte bancaire principal',
      color: '#3B82F6'
    },
    'cash': {
      label: '💵 Espèces',
      description: 'Caisse espèces',
      color: '#10B981'
    }
  };

  // Calculer les soldes par département
  const departmentBalances = useMemo(() => {
    const balances = {
      'magedabord': 0,
      'crunch': 0,
      'square': 0,
      'divers': 0
    };

    orders.forEach(order => {
      // Seulement les commandes payées
      if (!order.isPaid) return;

      // Déterminer le département basé sur le contenu de la commande
      let department = 'magedabord'; // Par défaut
      
      // Analyser les items de la commande pour déterminer le département
      if (order.items && Array.isArray(order.items)) {
        const hasChickenItems = order.items.some(item => 
          item.dishName && (
            item.dishName.toLowerCase().includes('poulet') ||
            item.dishName.toLowerCase().includes('braisé') ||
            item.dishName.toLowerCase().includes('pané') ||
            item.dishName.toLowerCase().includes('chicken')
          )
        );
        
        const hasSnackItems = order.items.some(item => 
          item.dishName && (
            item.dishName.toLowerCase().includes('snack') ||
            item.dishName.toLowerCase().includes('boisson') ||
            item.dishName.toLowerCase().includes('jus') ||
            item.dishName.toLowerCase().includes('soda')
          )
        );

        if (hasChickenItems || hasSnackItems) {
          department = 'crunch';
        } else {
          department = 'magedabord';
        }
      }

      // Ajouter le montant au département approprié
      balances[department] += order.total || 0;
    });

    return balances;
  }, [orders]);

  // Calculer les soldes des comptes de paiement (pour référence)
  const accountBalances = useMemo(() => {
    const balances = {
      'Orange Money': 0,
      'MTN Mobile Money': 0,
      'Espèces': 0,
      'Virement Bancaire': 0
    };

    orders.forEach(order => {
      if (!order.isPaid) return;

      const payment = order.payment;
      
      if (payment && typeof payment === 'object' && Object.keys(payment).length > 0) {
        const paymentMethod = payment.method;
        const paymentProvider = payment.provider;
        
        if (paymentMethod === 'mobile_money') {
          if (paymentProvider === 'OM' || paymentProvider === 'Orange Money') {
            balances['Orange Money'] += order.total || 0;
          } else if (paymentProvider === 'MOMO' || paymentProvider === 'MTN') {
            balances['MTN Mobile Money'] += order.total || 0;
          } else {
            balances['Orange Money'] += order.total || 0;
          }
        } else if (paymentMethod === 'cash') {
          balances['Espèces'] += order.total || 0;
        } else if (paymentMethod === 'bank_transfer') {
          balances['Virement Bancaire'] += order.total || 0;
        } else if (paymentMethod === 'mixed') {
          balances['Espèces'] += (payment.cashAmount || 0);
          if (paymentProvider === 'OM' || paymentProvider === 'Orange Money') {
            balances['Orange Money'] += (payment.mobileAmount || 0);
          } else if (paymentProvider === 'MOMO' || paymentProvider === 'MTN') {
            balances['MTN Mobile Money'] += (payment.mobileAmount || 0);
          }
        } else {
          balances['Espèces'] += order.total || 0;
        }
      } else {
        // Fallback vers l'ancien format
        const oldPaymentMethod = order.paymentMethod;
        if (oldPaymentMethod && typeof oldPaymentMethod === 'object') {
          const methodId = oldPaymentMethod.id || '';
          const methodName = oldPaymentMethod.name || '';
          if (methodId.includes('om') || methodName.includes('Orange')) {
            balances['Orange Money'] += order.total || 0;
          } else if (methodId.includes('momo') || methodId.includes('mtn') || methodName.includes('MTN')) {
            balances['MTN Mobile Money'] += order.total || 0;
          } else if (methodId.includes('cash') || methodName.includes('Cash')) {
            balances['Espèces'] += order.total || 0;
          } else if (methodId.includes('bank') || methodName.includes('Bank')) {
            balances['Virement Bancaire'] += order.total || 0;
          } else {
            balances['Espèces'] += order.total || 0;
          }
        } else if (typeof oldPaymentMethod === 'string') {
          if (oldPaymentMethod.includes('Mobile') || oldPaymentMethod.includes('Orange')) {
            balances['Orange Money'] += order.total || 0;
          } else if (oldPaymentMethod.includes('MTN')) {
            balances['MTN Mobile Money'] += order.total || 0;
          } else if (oldPaymentMethod.includes('Cash') || oldPaymentMethod.includes('Espèces')) {
            balances['Espèces'] += order.total || 0;
          } else if (oldPaymentMethod.includes('Bank')) {
            balances['Virement Bancaire'] += order.total || 0;
          } else {
            balances['Espèces'] += order.total || 0;
          }
        } else {
          balances['Espèces'] += order.total || 0;
        }
      }
    });

    return balances;
  }, [orders]);

  // Charger les budgets et les soldes réels
  useEffect(() => {
  const loadData = async () => {
    try {
      // Charger les budgets
      const budgetsQuery = query(collection(db, 'budgets'), orderBy('createdAt', 'desc'));
      const budgetsSnapshot = await getDocs(budgetsQuery);
      const budgetsData = budgetsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));
      setBudgets(budgetsData);

      // Charger les soldes réels
      const realBalancesQuery = query(collection(db, 'realBalances'), orderBy('updatedAt', 'desc'));
      const realBalancesSnapshot = await getDocs(realBalancesQuery);
      if (!realBalancesSnapshot.empty) {
        const latestBalances = realBalancesSnapshot.docs[0].data();
        setRealBalances({
          'magedabord': latestBalances.magedabord || 0,
          'crunch': latestBalances.crunch || 0,
          'square': latestBalances.square || 0,
          'divers': latestBalances.divers || 0
        });
      }
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };
    loadData();
  }, []);

  // Gérer la création/modification de budget
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const budgetData = {
        title: formData.title,
        amount: Number(formData.amount),
        department: formData.department,
        withdrawalAccount: formData.withdrawalAccount,
        status: 'pending',
        createdAt: Timestamp.now()
      };

      if (editingBudget) {
        await updateDoc(doc(db, 'budgets', editingBudget.id), budgetData);
        setBudgets(prev => prev.map(b => b.id === editingBudget.id ? { ...b, ...budgetData } : b));
      } else {
        const docRef = await addDoc(collection(db, 'budgets'), budgetData);
        setBudgets(prev => [{ id: docRef.id, ...budgetData }, ...prev]);
      }

      setShowModal(false);
      setEditingBudget(null);
      setFormData({ title: '', amount: '', department: '', withdrawalAccount: '' });
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError('Erreur lors de la sauvegarde');
    }
  };

  // Approuver un budget (simple)
  const handleApprove = async (budgetId) => {
    if (window.confirm('Approuver ce budget ?')) {
      try {
        await updateDoc(doc(db, 'budgets', budgetId), {
          status: 'approved',
          approvedAt: Timestamp.now()
        });
        setBudgets(prev => prev.map(b => 
          b.id === budgetId ? { ...b, status: 'approved', approvedAt: new Date() } : b
        ));
      } catch (err) {
        console.error('Erreur lors de l\'approbation:', err);
        setError('Erreur lors de l\'approbation');
      }
    }
  };

  // Supprimer un budget
  const handleDelete = async (budgetId) => {
    if (window.confirm('Supprimer ce budget ?')) {
      try {
        await deleteDoc(doc(db, 'budgets', budgetId));
        setBudgets(prev => prev.filter(b => b.id !== budgetId));
      } catch (err) {
        console.error('Erreur lors de la suppression:', err);
        setError('Erreur lors de la suppression');
      }
    }
  };

  // Sauvegarder les soldes réels
  const handleSaveRealBalances = async () => {
    try {
      await addDoc(collection(db, 'realBalances'), {
        ...realBalances,
        updatedAt: Timestamp.now(),
        updatedBy: 'Comptable'
      });
      setShowBalanceModal(false);
      setEditingBalance(null);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde des soldes:', err);
      setError('Erreur lors de la sauvegarde des soldes');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">💰 Gestion des Budgets</h2>
          <p className="text-gray-600">Créer et gérer les budgets</p>
        </div>
        <div className="flex space-x-3">
          {userRole === 'accountant' && (
            <button
              onClick={() => setShowBalanceModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              💰 Mettre à jour les soldes
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Nouveau Budget
          </button>
        </div>
      </div>

      {/* Soldes par département */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">🏢 Soldes par Département</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(departmentBalances).map(([dept, calculatedBalance]) => {
            const realBalance = realBalances[dept] || 0;
            const isRealBalanceSet = realBalance > 0;
            const displayBalance = isRealBalanceSet ? realBalance : calculatedBalance;
            const deptInfo = DEPARTMENTS[dept];
            
            return (
              <div key={dept} className={`rounded-lg p-4 text-center ${isRealBalanceSet ? 'bg-green-50 border-2 border-green-200' : 'bg-gray-50'}`}>
                <div className="text-2xl mb-2">
                  {deptInfo.icon}
                </div>
                <div className="font-medium text-sm text-gray-800">{deptInfo.label}</div>
                <div className="text-xs text-gray-500 mb-2">{deptInfo.description}</div>
                <div className={`text-lg font-bold ${isRealBalanceSet ? 'text-green-600' : 'text-blue-600'}`}>
                  {formatPrice(displayBalance)} FCFA
                </div>
                {isRealBalanceSet && (
                  <div className="text-xs text-green-600 mt-1">✓ Montant réel</div>
                )}
                {!isRealBalanceSet && (
                  <div className="text-xs text-blue-600 mt-1">Calculé automatiquement</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste des budgets */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">📋 Budgets ({budgets.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Département</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Compte de prélèvement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {budgets.map((budget) => (
                <tr key={budget.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{budget.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{formatPrice(budget.amount)} FCFA</div>
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="px-2 py-1 text-xs font-medium text-white rounded-full"
                      style={{ backgroundColor: DEPARTMENTS[budget.department]?.color || '#6B7280' }}
                    >
                      {DEPARTMENTS[budget.department]?.label || budget.department}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {budget.withdrawalAccount && WITHDRAWAL_ACCOUNTS[budget.withdrawalAccount] ? (
                      <span
                        className="px-2 py-1 text-xs font-medium text-white rounded-full inline-flex items-center"
                        style={{ backgroundColor: WITHDRAWAL_ACCOUNTS[budget.withdrawalAccount].color }}
                      >
                        {WITHDRAWAL_ACCOUNTS[budget.withdrawalAccount].label}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {budget.withdrawalAccount || 'Non spécifié'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(budget.status)}`}>
                      {budget.status === 'pending' ? 'En attente' : 'Approuvé'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      {budget.status === 'pending' && userRole === 'accountant' && (
                        <button
                          onClick={() => handleApprove(budget.id)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Approuver
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingBudget(budget);
                          setFormData(budget);
                          setShowModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(budget.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal simplifié */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingBudget ? 'Modifier le Budget' : 'Nouveau Budget'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA) *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Département *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                >
                  <option value="">Sélectionner un département...</option>
                  {Object.entries(DEPARTMENTS).map(([key, dept]) => (
                    <option key={key} value={key}>
                      {dept.label} - {dept.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Compte de prélèvement *</label>
                <select
                  value={formData.withdrawalAccount}
                  onChange={(e) => setFormData({ ...formData, withdrawalAccount: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
                  required
                >
                  <option value="">Sélectionner un compte...</option>
                  {Object.entries(WITHDRAWAL_ACCOUNTS).map(([key, account]) => (
                    <option key={key} value={key}>
                      {account.label} - {account.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingBudget(null);
                    setFormData({ title: '', amount: '', department: '', withdrawalAccount: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingBudget ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal pour saisir les soldes réels */}
      {showBalanceModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">💰 Mettre à jour les soldes réels par département</h3>
            <p className="text-sm text-gray-600 mb-4">
              Saisissez les montants exacts disponibles pour chaque département (laissé vide = calculé automatiquement)
            </p>
            
            <div className="space-y-4">
              {Object.entries(realBalances).map(([dept, balance]) => {
                const deptInfo = DEPARTMENTS[dept];
                const calculatedBalance = departmentBalances[dept] || 0;
                
                return (
                  <div key={dept} className="flex items-center space-x-4">
                    <div className="w-40 text-sm font-medium text-gray-700">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{deptInfo.icon}</span>
                        <div>
                          <div className="font-medium">{deptInfo.label}</div>
                          <div className="text-xs text-gray-500">{deptInfo.description}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        value={balance || ''}
                        onChange={(e) => setRealBalances(prev => ({
                          ...prev,
                          [dept]: e.target.value ? Number(e.target.value) : 0
                        }))}
                        className="w-full border rounded-md px-3 py-2"
                        placeholder="Montant en FCFA"
                        min="0"
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      Calculé: {formatPrice(calculatedBalance)} FCFA
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowBalanceModal(false);
                  setEditingBalance(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveRealBalances}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Sauvegarder les soldes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">{error}</div>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
};

export default BudgetManager;






