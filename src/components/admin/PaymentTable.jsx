import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { VirtualizedList } from '../../utils/performanceOptimizer';
import { usePrefersReducedMotion } from '../../utils/performanceOptimizer';

const PaymentTable = ({ filteredPayments, loading, onSelectPayment }) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  const renderPaymentItem = useCallback((payment) => (
    <motion.tr
      key={payment.id}
      initial={!prefersReducedMotion ? { opacity: 0, y: 20 } : "false"}
      animate={!prefersReducedMotion ? { opacity: 1, y: 0 } : "false"}
      className="hover:bg-gray-50 cursor-pointer"
      onClick={() => onSelectPayment(payment)}
    >
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {payment.id.substring(0, 8)}...
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {payment.createdAt?.toDate?.() 
          ? payment.createdAt.toDate().toLocaleDateString('fr-FR')
          : new Date(payment.createdAt).toLocaleDateString('fr-FR')
        }
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
        {payment.amount.toLocaleString()} FCFA
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {payment.status}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {payment.method}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {payment.orderData?.customerName || payment.customerName || 'Non spécifié'}
        </div>
        <div className="text-xs text-gray-500">
          Commande #{payment.orderData?.orderNumber || 'N/A'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900 truncate max-w-[220px]" title={payment.orderData?.customerEmail || payment.customerEmail || ''}>
          {payment.orderData?.customerEmail || payment.customerEmail || '—'}
        </div>
        <div className="text-xs text-gray-500">
          {payment.orderData?.customerPhone || payment.customerPhone || '—'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {payment.orderData?.restaurant || 'Restaurant inconnu'}
        </div>
        <div className="text-xs text-gray-500">
          {payment.orderData?.totalItems || 0} article(s)
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900 truncate max-w-[240px]" title={payment.orderData?.address || ''}>
          {payment.orderData?.address || '—'}
        </div>
        <div className="text-xs text-gray-500">
          {(payment.orderData?.deliveryMethod || '—') + (payment.orderData?.city ? ` • ${payment.orderData.city}` : '')}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-[200px]" title={payment.orderData?.note || ''}>
        {payment.orderData?.note || '—'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        <div>
          <span className="text-gray-500">Sous-total:</span>{' '}
          <span className="font-medium">
            {Number(payment.orderData?.subtotal ?? payment.amount ?? 0).toLocaleString()} FCFA
          </span>
        </div>
        <div>
          <span className="text-gray-500">Livraison:</span>{' '}
          <span className="font-medium">
            {Number(payment.orderData?.deliveryFee ?? 0).toLocaleString()} FCFA
          </span>
        </div>
        <div>
          <span className="text-gray-500">Total:</span>{' '}
          <span className="font-semibold text-gray-900">
            {Number(payment.orderData?.totalWithDelivery ?? payment.amount ?? 0).toLocaleString()} FCFA
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectPayment(payment);
          }}
          className="text-blue-600 hover:text-blue-900"
        >
          <Eye className="w-4 h-4" />
        </button>
      </td>
    </motion.tr>
  ), [prefersReducedMotion, onSelectPayment]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (filteredPayments.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Aucun paiement trouvé
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Transaction</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Méthode</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client & Commande</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant & Articles</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse & Livraison</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Détails Montants</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredPayments.length > 100 ? (
            <VirtualizedList
              items={filteredPayments}
              itemHeight={73}
              renderItem={renderPaymentItem}
              className="h-96"
            />
          ) : (
            filteredPayments.map(renderPaymentItem)
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentTable;
