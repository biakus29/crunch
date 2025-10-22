import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FaEdit,
  FaSave,
  FaTimes,
  FaPlus,
  FaMinus,
  FaCalculator,
  FaHistory,
  FaCheck,
  FaExclamationTriangle,
  FaInfoCircle,
  FaMoneyBillWave,
  FaWallet,
  FaCreditCard,
  FaMobile,
  FaUniversity
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { formatPrice } from '../../utils/adminUtils';

const AccountAdjustmentManager = ({ userRole }) => {
  // États pour les comptes
  const [accounts, setAccounts] = useState([
    {
      id: 'cash',
      name: 'Caisse Principale',
      type: 'cash',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Caisse principale du restaurant'
    },
    {
      id: 'om',
      name: 'Orange Money',
      type: 'mobile',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Compte Orange Money'
    },
    {
      id: 'mtn',
      name: 'MTN Mobile Money',
      type: 'mobile',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Compte MTN Mobile Money'
    },
    {
      id: 'bank',
      name: 'Compte Bancaire',
      type: 'bank',
      currentBalance: 0,
      lastUpdated: new Date(),
      description: 'Compte bancaire principal'
    }
  ]);

  // États pour l'interface
  const [editingAccount, setEditingAccount] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('credit'); // credit ou debit
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [adjustmentHistory, setAdjustmentHistory] = useState([]);

  // Icônes par type de compte
  const accountIcons = {
    cash: <FaMoneyBillWave className="text-green-600" />,
    mobile: <FaMobile className="text-orange-600" />,
    bank: <FaUniversity className="text-blue-600" />
  };

  // Couleurs par type de compte
  const accountColors = {
    cash: 'green',
    mobile: 'orange',
    bank: 'blue'
  };

  // Calculer le solde total
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, account) => sum + account.currentBalance, 0);
  }, [accounts]);

  // Gérer l'édition d'un compte
  const handleEditAccount = (account) => {
    setEditingAccount(account.id);
  };

  // Sauvegarder les modifications d'un compte
  const handleSaveAccount = (accountId, newBalance) => {
    setAccounts(prev => prev.map(account => 
      account.id === accountId 
        ? { 
            ...account, 
            currentBalance: parseFloat(newBalance) || 0,
            lastUpdated: new Date()
          }
        : account
    ));
    setEditingAccount(null);
    toast.success('Solde mis à jour avec succès');
  };

  // Annuler l'édition
  const handleCancelEdit = () => {
    setEditingAccount(null);
  };

  // Ouvrir le modal d'ajustement
  const handleOpenAdjustment = (account) => {
    setSelectedAccount(account);
    setShowAdjustmentModal(true);
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setAdjustmentType('credit');
  };

  // Fermer le modal d'ajustement
  const handleCloseAdjustment = () => {
    setShowAdjustmentModal(false);
    setSelectedAccount(null);
    setAdjustmentAmount('');
    setAdjustmentReason('');
  };

  // Effectuer un ajustement
  const handleApplyAdjustment = () => {
    if (!selectedAccount || !adjustmentAmount || !adjustmentReason) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Le montant doit être un nombre positif');
      return;
    }

    const newBalance = adjustmentType === 'credit' 
      ? selectedAccount.currentBalance + amount
      : selectedAccount.currentBalance - amount;

    if (newBalance < 0) {
      toast.error('Le solde ne peut pas être négatif');
      return;
    }

    // Mettre à jour le compte
    setAccounts(prev => prev.map(account => 
      account.id === selectedAccount.id 
        ? { 
            ...account, 
            currentBalance: newBalance,
            lastUpdated: new Date()
          }
        : account
    ));

    // Ajouter à l'historique
    const adjustment = {
      id: Date.now(),
      accountId: selectedAccount.id,
      accountName: selectedAccount.name,
      type: adjustmentType,
      amount: amount,
      reason: adjustmentReason,
      timestamp: new Date(),
      newBalance: newBalance
    };

    setAdjustmentHistory(prev => [adjustment, ...prev.slice(0, 49)]); // Garder les 50 derniers

    toast.success(`Ajustement de ${formatPrice(amount)} appliqué avec succès`);
    handleCloseAdjustment();
  };

  // Formater la date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">💰 Ajustement des Comptes</h2>
            <p className="text-gray-600">Gestion des soldes et ajustements comptables</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-600">
              {formatPrice(totalBalance)} FCFA
            </div>
            <div className="text-sm text-gray-500">Solde Total</div>
          </div>
        </div>
      </div>

      {/* Comptes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {accounts.map((account) => (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm p-6 border-l-4"
            style={{ borderLeftColor: accountColors[account.type] === 'green' ? '#10B981' : accountColors[account.type] === 'orange' ? '#F59E0B' : '#3B82F6' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {accountIcons[account.type]}
                <div>
                  <h3 className="font-semibold text-gray-900">{account.name}</h3>
                  <p className="text-sm text-gray-500">{account.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleEditAccount(account)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FaEdit />
              </button>
            </div>

            <div className="space-y-3">
              {editingAccount === account.id ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={account.currentBalance}
                    onChange={(e) => setAccounts(prev => prev.map(acc => 
                      acc.id === account.id 
                        ? { ...acc, currentBalance: parseFloat(e.target.value) || 0 }
                        : acc
                    ))}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="Nouveau solde"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSaveAccount(account.id, account.currentBalance)}
                      className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center justify-center"
                    >
                      <FaSave className="mr-1" />
                      Sauver
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex-1 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 flex items-center justify-center"
                    >
                      <FaTimes className="mr-1" />
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatPrice(account.currentBalance)} FCFA
                  </div>
                  <div className="text-xs text-gray-500">
                    Mis à jour: {formatDate(account.lastUpdated)}
                  </div>
                  <button
                    onClick={() => handleOpenAdjustment(account)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center text-sm"
                  >
                    <FaCalculator className="mr-2" />
                    Ajuster
                  </button>
                </>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Historique des ajustements */}
      {adjustmentHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FaHistory className="mr-2 text-gray-600" />
            Historique des Ajustements
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {adjustmentHistory.map((adjustment) => (
              <div key={adjustment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    adjustment.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {adjustment.type === 'credit' ? <FaPlus /> : <FaMinus />}
                  </div>
                  <div>
                    <div className="font-medium">{adjustment.accountName}</div>
                    <div className="text-sm text-gray-600">{adjustment.reason}</div>
                    <div className="text-xs text-gray-500">{formatDate(adjustment.timestamp)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${
                    adjustment.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {adjustment.type === 'credit' ? '+' : '-'}{formatPrice(adjustment.amount)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Solde: {formatPrice(adjustment.newBalance)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal d'ajustement */}
      {showAdjustmentModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Ajuster le Compte</h3>
              <button
                onClick={handleCloseAdjustment}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compte
                </label>
                <div className="p-3 bg-gray-50 rounded flex items-center space-x-3">
                  {accountIcons[selectedAccount.type]}
                  <div>
                    <div className="font-medium">{selectedAccount.name}</div>
                    <div className="text-sm text-gray-500">
                      Solde actuel: {formatPrice(selectedAccount.currentBalance)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'ajustement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAdjustmentType('credit')}
                    className={`p-3 rounded border-2 flex items-center justify-center ${
                      adjustmentType === 'credit'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <FaPlus className="mr-2" />
                    Crédit (+)
                  </button>
                  <button
                    onClick={() => setAdjustmentType('debit')}
                    className={`p-3 rounded border-2 flex items-center justify-center ${
                      adjustmentType === 'debit'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <FaMinus className="mr-2" />
                    Débit (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant (FCFA)
                </label>
                <input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Entrez le montant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raison de l'ajustement
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Décrivez la raison de cet ajustement..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleApplyAdjustment}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
                >
                  <FaCheck className="mr-2" />
                  Appliquer
                </button>
                <button
                  onClick={handleCloseAdjustment}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center"
                >
                  <FaTimes className="mr-2" />
                  Annuler
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AccountAdjustmentManager;
