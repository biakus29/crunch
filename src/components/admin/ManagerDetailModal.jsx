import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTimes,
  FaUser,
  FaStore,
  FaMoneyBillWave,
  FaShoppingCart,
  FaReceipt,
  FaChartLine,
  FaCalendarAlt,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaDownload
} from 'react-icons/fa';

const ManagerDetailModal = ({ manager, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Normaliser les données pour garantir des hooks constants entre rendus
  const m = useMemo(() => ({
    manager: manager?.manager || { name: '', email: '', role: '' },
    restaurant: manager?.restaurant || null,
    expenses: { items: [], total: 0, count: 0, ...(manager?.expenses || {}) },
    purchases: { items: [], total: 0, count: 0, ...(manager?.purchases || {}) },
    orders: { items: [], count: 0, total: 0, ...(manager?.orders || {}) },
    financial: { revenue: 0, costs: 0, profit: 0, margin: 0, ...(manager?.financial || {}) }
  }), [manager]);

  // Verrouiller le scroll de la page et gérer la touche Escape
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  // Calculs détaillés
  const expensesByCategory = useMemo(() => {
    const categories = {};
    m.expenses.items.forEach(expense => {
      const category = expense.categoryName || 'Autres';
      if (!categories[category]) {
        categories[category] = { total: 0, count: 0, items: [] };
      }
      categories[category].total += expense.amount || expense.total || 0;
      categories[category].count += 1;
      categories[category].items.push(expense);
    });
    return categories;
  }, [m.expenses.items]);

  const purchasesByMonth = useMemo(() => {
    const months = {};
    m.purchases.items.forEach(purchase => {
      const date = purchase.date || purchase.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0];
      if (date) {
        const month = date.substring(0, 7); // YYYY-MM
        if (!months[month]) {
          months[month] = { total: 0, count: 0 };
        }
        months[month].total += purchase.total || 0;
        months[month].count += 1;
      }
    });
    return months;
  }, [m.purchases.items]);

  const recentTransactions = useMemo(() => {
    const transactions = [
      ...m.expenses.items.map(exp => ({
        ...exp,
        type: 'expense',
        amount: exp.amount || exp.total || 0,
        date: exp.date,
        description: exp.description || 'Dépense'
      })),
      ...m.purchases.items.map(purchase => ({
        ...purchase,
        type: 'purchase',
        amount: purchase.total || 0,
        date: purchase.date,
        description: `Achat - ${purchase.selectedIngredients?.length || 0} ingrédients`
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    
    return transactions;
  }, [m.expenses.items, m.purchases.items]);

  const exportManagerData = () => {
    const data = {
      'Informations Gérant': {
        'Nom': m.manager.name,
        'Email': m.manager.email,
        'Rôle': m.manager.role,
        'Restaurant': m.restaurant?.name || 'N/A'
      },
      'Métriques Financières': {
        'Revenus': `${m.financial.revenue.toLocaleString()} FCFA`,
        'Dépenses': `${m.expenses.total.toLocaleString()} FCFA`,
        'Achats': `${m.purchases.total.toLocaleString()} FCFA`,
        'Coûts Totaux': `${m.financial.costs.toLocaleString()} FCFA`,
        'Bénéfice': `${m.financial.profit.toLocaleString()} FCFA`,
        'Marge': `${m.financial.margin.toFixed(2)}%`
      },
      'Activité': {
        'Nombre de Commandes': m.orders.count,
        'Nombre de Dépenses': m.expenses.count,
        'Nombre d\'Achats': m.purchases.count
      }
    };

    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `details-${(m.manager.name || 'gerant').replace(/\s+/g, '-')}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Si la modal n'est pas ouverte, ne rien afficher (les hooks au-dessus restent constants)
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl w-[95vw] max-w-6xl h-[90vh] max-h-[90vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold">
                    {m.manager.name?.charAt(0) || m.manager.email?.charAt(0)}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{m.manager.name || m.manager.email}</h2>
                  <p className="text-blue-100">{m.manager.role}</p>
                  <div className="flex items-center mt-1">
                    <FaStore className="mr-2" />
                    <span>{m.restaurant?.name || 'Restaurant non assigné'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={exportManagerData}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors"
                  title="Exporter les données"
                >
                  <FaDownload />
                </button>
                <button
                  onClick={onClose}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors"
                >
                  <FaTimes />
                </button>
              </div>
            </div>
          </div>

          {/* Métriques rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {m.financial.revenue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Revenus (FCFA)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {m.financial.costs.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Coûts (FCFA)</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${m.financial.profit >= 0 ? 'text-green-600' : 'text-red-600'}` }>
                {m.financial.profit.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Bénéfice (FCFA)</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${m.financial.margin >= 10 ? 'text-green-600' : 'text-red-600'}` }>
                {m.financial.margin.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Marge</div>
            </div>
          </div>

          {/* Onglets */}
          <div className="border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: FaChartLine },
                { id: 'orders', label: 'Commandes', icon: FaShoppingCart },
                { id: 'expenses', label: 'Dépenses', icon: FaReceipt },
                { id: 'purchases', label: 'Achats', icon: FaShoppingCart },
                { id: 'transactions', label: 'Transactions', icon: FaMoneyBillWave }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contenu des onglets */}
          <div className="p-6 flex-1 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Répartition des coûts */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Répartition des Coûts</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-800">Dépenses Générales</p>
                          <p className="text-2xl font-bold text-red-600">
                            {m.expenses.total.toLocaleString()} FCFA
                          </p>
                        </div>
                        <FaReceipt className="text-red-400 text-2xl" />
                      </div>
                      <p className="text-sm text-red-600 mt-2">
                        {m.expenses.count} transactions
                      </p>
                    </div>
                    
                    <div className="bg-orange-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-orange-800">Achats Approvisionnement</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {m.purchases.total.toLocaleString()} FCFA
                          </p>
                        </div>
                        <FaShoppingCart className="text-orange-400 text-2xl" />
                      </div>
                      <p className="text-sm text-orange-600 mt-2">
                        {m.purchases.count} listes d'achat
                      </p>
                    </div>
                  </div>
                </div>

                {/* Performance */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Indicateurs de Performance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <FaMoneyBillWave className="text-blue-600 text-2xl mx-auto mb-2" />
                      <p className="text-sm font-medium text-blue-800">Revenus par Commande</p>
                      <p className="text-xl font-bold text-blue-600">
                        {m.orders.count > 0 
                          ? (m.financial.revenue / m.orders.count).toLocaleString()
                          : '0'
                        } FCFA
                      </p>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <FaEquals className="text-green-600 text-2xl mx-auto mb-2" />
                      <p className="text-sm font-medium text-green-800">Coût par Commande</p>
                      <p className="text-xl font-bold text-green-600">
                        {m.orders.count > 0 
                          ? (m.financial.costs / m.orders.count).toLocaleString()
                          : '0'
                        } FCFA
                      </p>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      {m.financial.profit >= 0 ? (
                        <FaArrowUp className="text-purple-600 text-2xl mx-auto mb-2" />
                      ) : (
                        <FaArrowDown className="text-purple-600 text-2xl mx-auto mb-2" />
                      )}
                      <p className="text-sm font-medium text-purple-800">Statut</p>
                      <p className="text-xl font-bold text-purple-600">
                        {m.financial.profit >= 0 ? 'Rentable' : 'Déficitaire'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Commandes Créées</h3>
                {m.orders.items && m.orders.items.length > 0 ? (
                  m.orders.items.map((order, index) => (
                    <div key={order.id || index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-3">
                          <FaShoppingCart className="text-green-500" />
                          <div>
                            <p className="font-medium">
                              Commande #{order.id ? order.id.slice(-6) : `CMD${index + 1}`}
                            </p>
                            <p className="text-sm text-gray-600">
                              {order.customer?.name || 'Client inconnu'} • 
                              {new Date(order.createdAt?.toDate?.() || order.createdAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-green-600">
                          {order.total?.toLocaleString() || '0'} FCFA
                        </span>
                      </div>

                      {/* Articles commandés */}
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Articles :</p>
                        <div className="space-y-1">
                          {order.items?.slice(0, 3).map((item, itemIndex) => (
                            <div key={itemIndex} className="text-xs text-gray-600 flex justify-between">
                              <span>{item.quantity}x {item.name}</span>
                              <span>{(item.total || (item.price * item.quantity)).toLocaleString()} FCFA</span>
                            </div>
                          ))}
                          {order.items?.length > 3 && (
                            <div className="text-xs text-gray-400">
                              +{order.items.length - 3} autres articles
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Moyen de paiement */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <div className="flex items-center space-x-2">
                          <FaMoneyBillWave className="text-blue-500" />
                          <span className="text-sm font-medium">Paiement :</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.payment?.method === 'cash' ? 'bg-green-100 text-green-800' :
                            order.payment?.method === 'mobile_money' ? 'bg-blue-100 text-blue-800' :
                            order.payment?.method === 'bank_transfer' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.payment?.method === 'cash' ? 'Espèces' :
                             order.payment?.method === 'mobile_money' ? 'Mobile Money' :
                             order.payment?.method === 'bank_transfer' ? 'Virement' :
                             order.payment?.method || 'Non spécifié'}
                          </span>
                        </div>
                        <div className="text-right">
                          {order.payment?.method === 'mobile_money' && (
                            <div className="text-xs text-gray-600">
                              <div>{order.payment.provider === 'OM' ? 'OM' : 
                                     order.payment.provider === 'MOMO' ? 'MTN' : 
                                     order.payment.provider}</div>
                              {order.payment.transactionId && (
                                <div>ID: {order.payment.transactionId}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FaShoppingCart className="text-4xl mx-auto mb-4 text-gray-300" />
                    <p>Aucune commande créée par ce gérant</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Dépenses par Catégorie</h3>
                {Object.entries(expensesByCategory).map(([category, data]) => (
                  <div key={category} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{category}</h4>
                      <span className="text-lg font-bold text-red-600">
                        {data.total.toLocaleString()} FCFA
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{data.count} transactions</p>
                    <div className="mt-2 space-y-1">
                      {data.items.slice(0, 3).map((item, index) => (
                        <div key={index} className="text-xs text-gray-500 flex justify-between">
                          <span>{item.description || 'Dépense'}</span>
                          <span>{(item.amount || item.total || 0).toLocaleString()} FCFA</span>
                        </div>
                      ))}
                      {data.items.length > 3 && (
                        <div className="text-xs text-gray-400">
                          +{data.items.length - 3} autres transactions
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'purchases' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Achats par Mois</h3>
                {Object.entries(purchasesByMonth).map(([month, data]) => (
                  <div key={month} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">
                          {new Date(month + '-01').toLocaleDateString('fr-FR', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </h4>
                        <p className="text-sm text-gray-600">{data.count} listes d'achat</p>
                      </div>
                      <span className="text-lg font-bold text-orange-600">
                        {data.total.toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Transactions Récentes</h3>
                {recentTransactions.map((transaction, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        {transaction.type === 'expense' ? (
                          <FaReceipt className="text-red-500" />
                        ) : (
                          <FaShoppingCart className="text-orange-500" />
                        )}
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(transaction.date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold ${
                        transaction.type === 'expense' ? 'text-red-600' : 'text-orange-600'
                      }`}>
                        {transaction.amount.toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer sticky */}
          <div className="border-t bg-white p-4 flex justify-end space-x-3">
            <button
              onClick={exportManagerData}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Exporter les données
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Fermer
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
;

export default ManagerDetailModal;
