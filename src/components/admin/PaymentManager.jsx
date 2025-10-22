/**
 * Page complète de gestion des paiements - Affichage de toutes les données de commandes A-Z
 * Interface simple et claire pour visualiser tous les paiements et données financières
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { 
  Search, 
  Download, 
  RefreshCw, 
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Package,
  CreditCard,
  Truck,
  Trash2,
  Database
} from 'lucide-react';
import { collection, query, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  fetchPayments, 
  deleteTestPaymentsAndOrders, 
  syncPaymentsWithOrders,
  backfillAllPayments 
} from '../../services/paymentsService';

// Statuts des commandes
const ORDER_STATUS = {
  'en_attente': { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  'en_preparation': { label: 'En préparation', color: 'bg-blue-100 text-blue-800', icon: Package },
  'prete': { label: 'Prête', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
  'en_livraison': { label: 'En livraison', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  'livree': { label: 'Livrée', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'annulee': { label: 'Annulée', color: 'bg-red-100 text-red-800', icon: XCircle }
};

// Méthodes de paiement
const PAYMENT_METHODS = {
  'cash_delivery': { label: 'Cash à la livraison', icon: CreditCard, color: 'bg-green-50 text-green-700' },
  'mobile_money': { label: 'Mobile Money', icon: Phone, color: 'bg-blue-50 text-blue-700' },
  'card': { label: 'Carte bancaire', icon: CreditCard, color: 'bg-purple-50 text-purple-700' }
};

// Composant de statistiques
const PaymentStats = memo(({ payments, loading }) => {
  const stats = useMemo(() => {
    if (!payments.length) {
      return {
        totalAmount: 0,
        totalTransactions: 0,
        successRate: 0,
        averageAmount: 0,
        todayAmount: 0,
        monthAmount: 0,
        ordersCountCompleted: 0,
        totalOrderAmountCompleted: 0,
        totalDeliveryFeesCompleted: 0,
        averageOrderValue: 0,
        averageItemsPerOrder: 0,
        uniqueCustomers: 0
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalAmount = payments.reduce((sum, payment) =>
      payment.status === 'completed' ? sum + Number(payment.amount || 0) : sum, 0
    );

    const completedPayments = payments.filter(p => p.status === 'completed');
    const successRate = payments.length > 0 ? (completedPayments.length / payments.length) * 100 : 0;

    const todayAmount = payments
      .filter(p => p.status === 'completed' && new Date(p.createdAt?.toDate?.() || p.createdAt) >= today)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const monthAmount = payments
      .filter(p => p.status === 'completed' && new Date(p.createdAt?.toDate?.() || p.createdAt) >= monthStart)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // Orders-like KPIs based on enriched orderData
    const completedLinked = completedPayments.filter(p => p.orderId);
    const ordersCountCompleted = completedLinked.length;
    const totalOrderAmountCompleted = completedLinked.reduce((sum, p) => {
      const val = p.orderData?.totalWithDelivery ?? p.amount;
      return sum + Number(val || 0);
    }, 0);
    const totalDeliveryFeesCompleted = completedLinked.reduce((sum, p) => sum + Number(p.orderData?.deliveryFee || 0), 0);
    const averageOrderValue = ordersCountCompleted > 0 ? totalOrderAmountCompleted / ordersCountCompleted : 0;
    const averageItemsPerOrder = ordersCountCompleted > 0 ? (completedLinked.reduce((s, p) => s + Number(p.orderData?.totalItems || 0), 0) / ordersCountCompleted) : 0;
    const uniqueCustomers = (() => {
      const keys = new Set();
      payments.forEach(p => {
        const k = p.customerEmail || p.customerPhone || p.customerName || p.id;
        keys.add(k);
      });
      return keys.size;
    })();

    return {
      totalAmount,
      totalTransactions: payments.length,
      successRate: Math.round(successRate),
      averageAmount: completedPayments.length > 0 ? totalAmount / completedPayments.length : 0,
      todayAmount,
      monthAmount,
      ordersCountCompleted,
      totalOrderAmountCompleted,
      totalDeliveryFeesCompleted,
      averageOrderValue,
      averageItemsPerOrder,
      uniqueCustomers
    };
  }, [payments]);

  const statCards = [
    {
      title: 'Total des revenus',
      value: `${stats.totalAmount.toLocaleString()} FCFA`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Transactions',
      value: stats.totalTransactions.toLocaleString(),
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Taux de réussite',
      value: `${stats.successRate}%`,
      icon: stats.successRate >= 90 ? TrendingUp : TrendingDown,
      color: stats.successRate >= 90 ? 'text-green-600' : 'text-red-600',
      bgColor: stats.successRate >= 90 ? 'bg-green-50' : 'bg-red-50'
    },
    {
      title: 'Montant moyen',
      value: `${Math.round(stats.averageAmount).toLocaleString()} FCFA`,
      icon: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Aujourd\'hui',
      value: `${stats.todayAmount.toLocaleString()} FCFA`,
      icon: Calendar,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Ce mois',
      value: `${stats.monthAmount.toLocaleString()} FCFA`,
      icon: PieChart,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    // Extended KPIs mirroring orders section numerically
    {
      title: 'Commandes payées',
      value: stats.ordersCountCompleted.toLocaleString(),
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      title: 'CA commandes (payées)',
      value: `${Math.round(stats.totalOrderAmountCompleted).toLocaleString()} FCFA`,
      icon: DollarSign,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50'
    },
    {
      title: 'Frais livraison (payées)',
      value: `${Math.round(stats.totalDeliveryFeesCompleted).toLocaleString()} FCFA`,
      icon: Truck,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Panier moyen (valeur)',
      value: `${Math.round(stats.averageOrderValue).toLocaleString()} FCFA`,
      icon: BarChart3,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50'
    },
    {
      title: 'Articles / commande',
      value: stats.averageItemsPerOrder.toFixed(1),
      icon: ShoppingCart,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50'
    },
    {
      title: 'Clients uniques',
      value: stats.uniqueCustomers.toLocaleString(),
      icon: Users,
      color: 'text-fuchsia-600',
      bgColor: 'bg-fuchsia-50'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-6 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`${stat.bgColor} rounded-lg shadow-sm p-4`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
            {(() => {
              const IconComp = stat.icon || AlertCircle;
              if (!stat.icon) {
                // Aide au debug si un icône est indéfini
                // eslint-disable-next-line no-console
                console.warn('[PaymentStats] Icon undefined for card:', stat.title);
              }
              return <IconComp className={`w-8 h-8 ${stat.color}`} />;
            })()}
          </div>
        </motion.div>
      ))}
    </div>
  );
});

// Composant de détail d'un paiement
const PaymentDetail = memo(({ payment, onClose }) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const status = PAYMENT_STATUS[payment.status] || PAYMENT_STATUS.pending;
  const method = PAYMENT_METHODS[payment.method] || PAYMENT_METHODS.card;

  return (
    <motion.div
      initial={!prefersReducedMotion ? { opacity: 0 } : "false"}
        animate={!prefersReducedMotion ? { opacity: 1 } : "false"}
        exit={!prefersReducedMotion ? { opacity: 0 } : "false"}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={!prefersReducedMotion ? { scale: 0.9, opacity: 0 } : "false"}
        animate={!prefersReducedMotion ? { scale: 1, opacity: 1 } : "false"}
        exit={!prefersReducedMotion ? { scale: 0.9, opacity: 0 } : "false"}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Détails du paiement</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informations générales */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID de transaction
                </label>
                <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                  {payment.id}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant
                </label>
                <p className="text-2xl font-bold text-green-600">
                  {payment.amount.toLocaleString()} FCFA
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${status.color}`}>
                  <status.icon className="w-4 h-4 mr-2" />
                  {status.label}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Méthode de paiement
                </label>
                <div className="flex items-center">
                  <method.icon className="w-5 h-5 mr-2 text-gray-600" />
                  <span className="text-sm text-gray-900">{method.label}</span>
                </div>
              </div>
            </div>

            {/* Informations client */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <p className="text-sm text-gray-900">
                  {payment.customerName || 'Non spécifié'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <p className="text-sm text-gray-900">
                  {payment.customerEmail || 'Non spécifié'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <p className="text-sm text-gray-900">
                  {payment.customerPhone || 'Non spécifié'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de création
                </label>
                <p className="text-sm text-gray-900">
                  {payment.createdAt?.toDate?.() 
                    ? payment.createdAt.toDate().toLocaleString('fr-FR')
                    : new Date(payment.createdAt).toLocaleString('fr-FR')
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Informations de commande */}
          {payment.orderId && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-lg font-medium mb-4">Informations de commande</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID de commande
                  </label>
                  <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                    {payment.orderId}
                  </p>
                </div>
                {payment.orderData?.orderNumber && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numéro de commande
                    </label>
                    <p className="text-sm text-gray-900">
                      {payment.orderData.orderNumber}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre d'articles
                  </label>
                  <p className="text-sm text-gray-900">
                    {payment.orderData?.totalItems ?? 'N/A'} article(s)
                  </p>
                </div>
                {payment.orderData?.totalWithDelivery !== undefined && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total commande (avec livraison)
                    </label>
                    <p className="text-sm text-gray-900 font-semibold">
                      {Number(payment.orderData.totalWithDelivery).toLocaleString()} FCFA
                    </p>
                  </div>
                )}
                {payment.orderData?.restaurant && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Restaurant
                    </label>
                    <p className="text-sm text-gray-900">
                      {payment.orderData.restaurant}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Informations techniques */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-medium mb-4">Informations techniques</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {payment.transactionId && (
                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    Transaction ID
                  </label>
                  <p className="text-gray-900 font-mono bg-gray-50 p-2 rounded text-xs">
                    {payment.transactionId}
                  </p>
                </div>
              )}
              {payment.currency && (
                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    Devise
                  </label>
                  <p className="text-gray-900">{payment.currency.toUpperCase()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Messages d'erreur */}
          {payment.errorMessage && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-lg font-medium mb-2 text-red-600">Message d'erreur</h4>
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">{payment.errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

// Composant principal de gestion des paiements
function PaymentManager() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { state, actions } = usePaymentsAdmin();
  const {
    payments,
    loading,
    searchTerm,
    filterStatus,
    filterMethod,
    dateRange,
    selectedPayment,
    hasMore,
    filteredPayments,
    pendingPayments,
    otherPayments,
    hideTestPayments
  } = state;
  const {
    setSearchTerm,
    setFilterStatus,
    setFilterMethod,
    setDateRange,
    setSelectedPayment,
    loadPayments,
    loadMore,
    syncPaymentsWithOrders,
    backfillAllPaymentsAction,
    updatePaymentStatus,
    handleExport,
    setHideTestPayments
  } = actions;

  // logique déplacée dans usePaymentsAdmin

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Paiements</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {filteredPayments.length} résultat{filteredPayments.length > 1 ? 's' : ''}
            </span>
            {pendingPayments.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse">
                <Clock className="w-3 h-3 mr-1" />
                {pendingPayments.length} en attente
              </span>
            )}
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleExport}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </button>
          <button
            onClick={async () => {
              try {
                const step1 = window.confirm('Voulez-vous supprimer DÉFINITIVEMENT les données de test (paiements et commandes liées) ?');
                if (!step1) return;
                const step2 = window.confirm('Action IRRÉVERSIBLE. Confirmez encore pour procéder.');
                if (!step2) return;
                toast.info('Suppression des données de test en cours...');
                const res = await deleteTestPaymentsAndOrders();
                toast.success(`Supprimé: ${res.paymentsDeleted} paiements, ${res.ordersDeleted} commandes`);
                await loadPayments(true);
              } catch (e) {
                console.error(e);
                toast.error('Erreur lors de la suppression des données de test');
              }
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer tests
          </button>
          <button
            onClick={() => loadPayments(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </button>
          <button
            onClick={syncPaymentsWithOrders}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Synchroniser
          </button>
          <button
            onClick={backfillAllPaymentsAction}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            Backfill Complet
          </button>
          {process.env.NODE_ENV !== 'production' && (
            <>
              <button
                onClick={async () => {
                  try {
                    await createTestPayment();
                    loadPayments(true);
                  } catch (error) {
                    console.error('Erreur création paiement test:', error);
                  }
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Test 1 Paiement
              </button>
              <button
                onClick={async () => {
                  try {
                    await createMultipleTestPayments();
                    loadPayments(true);
                  } catch (error) {
                    console.error('Erreur création paiements test:', error);
                  }
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Test 10 Paiements
              </button>
            </>
          )}
        </div>
      </div>

      {/* Section spéciale pour les paiements en attente */}
      {pendingPayments.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-3">
            <Clock className="w-5 h-5 text-yellow-600 mr-2" />
            <h3 className="text-lg font-semibold text-yellow-800">
              Paiements en attente ({pendingPayments.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingPayments.slice(0, 6).map(payment => (
              <div
                key={payment.id}
                className="bg-white border border-yellow-200 rounded-md p-3 cursor-pointer hover:bg-yellow-50 transition-colors"
                onClick={() => setSelectedPayment(payment)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {payment.id.substring(0, 8)}...
                  </span>
                  <span className="text-sm font-bold text-green-600">
                    {payment.amount.toLocaleString()} FCFA
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {payment.customerName || 'Client non spécifié'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {payment.createdAt?.toDate?.() 
                    ? payment.createdAt.toDate().toLocaleString('fr-FR')
                    : new Date(payment.createdAt).toLocaleString('fr-FR')
                  }
                </div>
              </div>
            ))}
          </div>
          {pendingPayments.length > 6 && (
            <div className="mt-3 text-center">
              <span className="text-sm text-yellow-700">
                +{pendingPayments.length - 6} autre(s) paiement(s) en attente
              </span>
            </div>
          )}
        </div>
      )}

      {/* Statistiques (basées sur la liste filtrée) */}
      <PaymentStats payments={filteredPayments} loading={loading} />

      {/* Filtres et recherche */}
      <PaymentFilters
        searchTerm={searchTerm}
        filterStatus={filterStatus}
        filterMethod={filterMethod}
        dateRange={dateRange}
        onSearch={setSearchTerm}
        onStatusChange={setFilterStatus}
        onMethodChange={setFilterMethod}
        onDateRangeChange={setDateRange}
        resultsCount={filteredPayments.length}
        hideTestPayments={hideTestPayments}
        onToggleHideTest={setHideTestPayments}
      />

      {/* Liste des paiements */}
      <PaymentTable
        filteredPayments={filteredPayments}
        loading={loading}
        onSelectPayment={setSelectedPayment}
      />

      {/* Pagination: Charger plus */}
      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Chargement...' : 'Charger plus'}
          </button>
        </div>
      )}

      {/* Modal de détail */}
      <AnimatePresence>
        {selectedPayment && (
          <PaymentDetail
            payment={selectedPayment}
            onClose={() => setSelectedPayment(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

PaymentStats.displayName = 'PaymentStats';
PaymentDetail.displayName = 'PaymentDetail';

export default PaymentManager;