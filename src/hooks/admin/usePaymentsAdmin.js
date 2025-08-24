import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { invalidateCache } from '../../utils/firebaseOptimizer';
import { 
  fetchPayments,
  enrichPaymentsWithOrders,
  syncPaymentsWithOrders as svcSyncPaymentsWithOrders,
  updatePaymentStatusByOrder,
  subscribePaymentsRealtime,
  subscribeOrdersStatus,
  backfillPaymentsFromOrders,
  subscribeNewOrdersCreatePayments,
  backfillPaymentsForCurrentMonth,
  backfillAllPayments,
  fetchPaymentsPage
} from '../../services/paymentsService';

export default function usePaymentsAdmin() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [hideTestPayments, setHideTestPayments] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);

  // Page size for pagination
  const ITEMS_PER_PAGE = 100;

  const loadPayments = useCallback(async (isInitial = false) => {
    try {
      setLoading(isInitial);
      // Invalider le cache pour éviter les anciennes données
      invalidateCache('payments');
      invalidateCache('orders');
      const { items, lastVisible: lv } = await fetchPaymentsPage({
        dateRange,
        filterStatus,
        filterMethod,
        itemsPerPage: ITEMS_PER_PAGE,
        startAfterDoc: null
      });
      const enriched = await enrichPaymentsWithOrders(items);
      setPayments(enriched);
      setLastVisible(lv);
      setHasMore(items.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Erreur lors du chargement des paiements:', error);
      toast.error('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  }, [dateRange, filterStatus, filterMethod]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    try {
      setLoading(true);
      const { items, lastVisible: lv } = await fetchPaymentsPage({
        dateRange,
        filterStatus,
        filterMethod,
        itemsPerPage: ITEMS_PER_PAGE,
        startAfterDoc: lastVisible
      });
      const enriched = await enrichPaymentsWithOrders(items);
      setPayments((prev) => [...prev, ...enriched]);
      setLastVisible(lv);
      setHasMore(items.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Erreur lors du chargement supplémentaire:', error);
      toast.error('Erreur lors du chargement supplémentaire');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, dateRange, filterStatus, filterMethod, lastVisible]);

  const syncPaymentsWithOrders = useCallback(async () => {
    try {
      setLoading(true);
      await svcSyncPaymentsWithOrders();
      await loadPayments(true);
      toast.success('Synchronisation des paiements terminée');
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      toast.error('Erreur lors de la synchronisation des paiements');
    } finally {
      setLoading(false);
    }
  }, [loadPayments]);

  const backfillAllPaymentsAction = useCallback(async () => {
    try {
      setLoading(true);
      const result = await backfillAllPayments();
      toast.success(`Backfill complet terminé: ${result.created} paiements créés sur ${result.scanned} commandes scannées`);
      await loadPayments(true);
    } catch (error) {
      console.error('Erreur lors du backfill complet:', error);
      toast.error('Erreur lors du backfill complet des paiements');
    } finally {
      setLoading(false);
    }
  }, [loadPayments]);

  const updatePaymentStatus = useCallback(async (orderId, isPaid) => {
    try {
      await updatePaymentStatusByOrder(orderId, isPaid);
      loadPayments(true);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut de paiement:', error);
    }
  }, [loadPayments]);

  useEffect(() => {
    const unsubscribeOrders = subscribeOrdersStatus((orderId, isPaid) => {
      updatePaymentStatus(orderId, isPaid);
    }, (error) => {
      console.error('Erreur listener commandes:', error);
    });
    return () => unsubscribeOrders();
  }, [updatePaymentStatus]);

  // Backfill au montage + abonnement aux nouvelles commandes pour créer les paiements automatiquement
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const res = await backfillPaymentsFromOrders();
        if (res?.created > 0) {
          toast.info(`${res.created} paiements créés depuis les commandes existantes`);
        }
        await loadPayments(true);
      } catch (e) {
        console.error('Erreur backfill paiements:', e);
      }
      try {
        unsub = subscribeNewOrdersCreatePayments((err) => {
          console.error('Erreur listener création paiement nouvelle commande:', err);
        });
      } catch (e) {
        console.error('Erreur abonnement nouvelles commandes:', e);
      }
    })();
    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, []);

  useEffect(() => {
    loadPayments(true);
  }, [dateRange, filterStatus, filterMethod, loadPayments]);

  // Quand on filtre par mois, on s'assure que tous les paiements du mois courant existent
  useEffect(() => {
    (async () => {
      if (dateRange === 'month') {
        try {
          const res = await backfillPaymentsForCurrentMonth();
          if (res?.created > 0) {
            toast.info(`${res.created} paiements ajoutés pour le mois courant`);
            await loadPayments(true);
          }
        } catch (e) {
          console.error('Erreur backfill mois courant:', e);
        }
      }
    })();
  }, [dateRange]);

  // Optionnel: on peut désactiver le temps réel pour éviter d'écraser la pagination
  // Conserver si vous souhaitez voir les tout derniers paiements arriver automatiquement
  // useEffect(() => {
  //   const unsubscribe = subscribePaymentsRealtime(
  //     { dateRange, filterStatus, filterMethod, itemsPerPage: ITEMS_PER_PAGE },
  //     async (paymentsData) => {
  //       try {
  //         const enriched = await enrichPaymentsWithOrders(paymentsData);
  //         setPayments(enriched);
  //         setHasMore(enriched.length === ITEMS_PER_PAGE);
  //       } catch (e) {
  //         console.error('Erreur enrichissement temps réel paiements:', e);
  //         setPayments(paymentsData);
  //         setHasMore(paymentsData.length === ITEMS_PER_PAGE);
  //       }
  //     },
  //     (error) => {
  //       console.error('Erreur listener paiements:', error);
  //     }
  //   );
  //   return () => unsubscribe();
  // }, [dateRange, filterStatus, filterMethod]);

  const filteredPayments = useMemo(() => {
    let filtered = payments;
    if (hideTestPayments) {
      filtered = filtered.filter(p => {
        const oid = String(p.orderId || '');
        const tid = String(p.transactionId || '');
        return !(oid.startsWith('test-order-') || tid.startsWith('test-transaction-'));
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.id.toLowerCase().includes(term) ||
        payment.customerName?.toLowerCase().includes(term) ||
        payment.customerEmail?.toLowerCase().includes(term) ||
        payment.orderId?.toLowerCase().includes(term)
      );
    }
    return filtered.sort((a, b) => {
      const aIsPending = a.status === 'pending' || a.status === 'false';
      const bIsPending = b.status === 'pending' || b.status === 'false';
      if (aIsPending && !bIsPending) return -1;
      if (!aIsPending && bIsPending) return 1;
      return new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt);
    });
  }, [payments, searchTerm, hideTestPayments]);

  const pendingPayments = useMemo(() => 
    filteredPayments.filter(payment => payment.status === 'pending' || payment.status === 'false'),
    [filteredPayments]
  );

  const otherPayments = useMemo(() => 
    filteredPayments.filter(payment => payment.status !== 'pending' && payment.status !== 'false'),
    [filteredPayments]
  );

  const handleExport = useCallback(() => {
    const csvContent = [
      ['ID', 'Date', 'Montant', 'Statut', 'Méthode', 'Client', 'Email'].join(','),
      ...filteredPayments.map(payment => [
        payment.id,
        payment.createdAt?.toDate?.() 
          ? payment.createdAt.toDate().toLocaleDateString('fr-FR')
          : new Date(payment.createdAt).toLocaleDateString('fr-FR'),
        payment.amount,
        payment.status,
        payment.method,
        payment.customerName || '',
        payment.customerEmail || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `paiements_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredPayments]);

  return {
    state: {
      payments, loading, searchTerm, filterStatus, filterMethod, dateRange, selectedPayment, hasMore,
      filteredPayments, pendingPayments, otherPayments, hideTestPayments
    },
    actions: {
      setSearchTerm, setFilterStatus, setFilterMethod, setDateRange, setSelectedPayment,
      loadPayments, loadMore, syncPaymentsWithOrders, backfillAllPaymentsAction, updatePaymentStatus, handleExport,
      setHideTestPayments
    }
  };
}
