import {
  collection,
  query as fsQuery,
  where as fsWhere,
  orderBy as fsOrderBy,
  limit as fsLimit,
  startAfter as fsStartAfter,
  onSnapshot,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  writeBatch,
  FieldPath,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { optimizedQuery, invalidateCache } from '../utils/firebaseOptimizer';
import { onSnapshot as fsOnSnapshot } from 'firebase/firestore';
import { calculateOrderTotals, getDisplayTotal } from '../utils/adminUtils';

// Build Firestore where constraints array from filters for onSnapshot usage
function buildFsConstraints({ dateRange, filterStatus, filterMethod, itemsPerPage }) {
  const constraints = [fsOrderBy('createdAt', 'desc')];

  if (dateRange && dateRange !== 'all') {
    const now = new Date();
    let startDate;
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = null;
    }
    if (startDate) constraints.push(fsWhere('createdAt', '>=', startDate));
  }

  if (filterStatus && filterStatus !== 'all') {
    constraints.push(fsWhere('status', '==', filterStatus));
  }

  if (filterMethod && filterMethod !== 'all') {
    constraints.push(fsWhere('method', '==', filterMethod));
  }

  if (itemsPerPage) constraints.push(fsLimit(itemsPerPage));

  return constraints;
}

export async function fetchPayments({ dateRange = 'all', filterStatus = 'all', filterMethod = 'all', itemsPerPage = 50 } = {}) {
  const whereClauses = [];

  if (dateRange !== 'all') {
    const now = new Date();
    let startDate;
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = null;
    }
    if (startDate) whereClauses.push(['createdAt', '>=', startDate]);
  }

  if (filterStatus !== 'all') {
    if (filterStatus === 'pending' || filterStatus === 'unpaid') {
      // Inclure pending et false pour les vues financières
      // optimizedQuery ne supporte pas 'in' custom ici => on récupère par statut pending et false séparément et on fusionne
      const [pending, unpaid] = await Promise.all([
        optimizedQuery('payments', { where: [['status', '==', 'pending']], orderBy: [['createdAt', 'desc']], limit: itemsPerPage, useCache: true, cacheTTL: 120000 }),
        optimizedQuery('payments', { where: [['status', '==', 'false']], orderBy: [['createdAt', 'desc']], limit: itemsPerPage, useCache: true, cacheTTL: 120000 })
      ]);
      const merged = [...pending, ...unpaid]
        .sort((a, b) => new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt))
        .slice(0, itemsPerPage);
      return merged;
    } else {
      whereClauses.push(['status', '==', filterStatus]);
    }
  }

  if (filterMethod !== 'all') {
    whereClauses.push(['method', '==', filterMethod]);
  }

  const payments = await optimizedQuery('payments', {
    orderBy: [['createdAt', 'desc']],
    where: whereClauses,
    limit: itemsPerPage,
    useCache: true,
    cacheTTL: 120000
  });

  return payments;
}

// Paged fetch using Firestore cursors for "Show more" UX
export async function fetchPaymentsPage({ dateRange = 'all', filterStatus = 'all', filterMethod = 'all', itemsPerPage = 100, startAfterDoc = null } = {}) {
  const constraints = buildFsConstraints({ dateRange, filterStatus, filterMethod, itemsPerPage });
  if (startAfterDoc) constraints.push(fsStartAfter(startAfterDoc));
  const q = fsQuery(collection(db, 'payments'), ...constraints);
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lastVisible = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { items, lastVisible };
}

export async function enrichPaymentsWithOrders(payments) {
  const enriched = await Promise.all(
    payments.map(async (payment) => {
      try {
        if (payment.orderId) {
          const orderSnap = await getDoc(doc(db, 'orders', payment.orderId));
          if (orderSnap?.exists?.()) {
            const order = { id: orderSnap.id, ...orderSnap.data() };
            // derive robust totals
            const items = Array.isArray(order.items) ? order.items : [];
            const itemsTotal = items.reduce((sum, it) => {
              const unit = Number(
                it.price !== undefined ? it.price : (it.dishPrice !== undefined ? it.dishPrice : 0)
              );
              const q = Number(it.quantity || 1);
              return sum + (isNaN(unit) ? 0 : unit) * (isNaN(q) ? 1 : q);
            }, 0);
            const fee = Number(order.deliveryFee);
            const fallbackTotal = itemsTotal + (isNaN(fee) ? 0 : fee);
            // Utiliser getDisplayTotal si order.items existe pour respecter customTotal/customDiscount
            let derivedAmount = Number(payment.amount) || 0;
            if (!derivedAmount && order.items && Array.isArray(order.items)) {
              try {
                const totals = calculateOrderTotals(order, [], []);
                derivedAmount = getDisplayTotal(order, totals);
              } catch (e) {
                derivedAmount = Number(order.totalWithDelivery) || Number(order.total) || fallbackTotal || 0;
              }
            } else if (!derivedAmount) {
              derivedAmount = Number(order.totalWithDelivery) || Number(order.total) || fallbackTotal || 0;
            }
            const customerName = order.contact?.name || order.customerName || 'Client inconnu';
            let customerPhone = order.contact?.phone || order.address?.phone || order.phone || null;
            if (!customerPhone && typeof order.userId === 'string' && order.userId.startsWith('guest-')) {
              const p = order.userId.slice(6);
              customerPhone = /^\d{6,}$/.test(p) ? p : null;
            }
            const customerEmail = order.contact?.email || order.customerEmail || null;
            return {
              ...payment,
              amount: derivedAmount,
              customerName: payment.customerName || customerName,
              customerPhone: payment.customerPhone || customerPhone,
              customerEmail: payment.customerEmail || customerEmail,
              orderData: {
                customerName,
                customerPhone,
                customerEmail,
                items: order.items || [],
                totalItems: order.items?.length || 0,
                restaurant: order.restaurant || 'Restaurant inconnu',
                orderNumber: order.orderNumber || payment.orderId.slice(-6),
                totalWithDelivery: (() => {
                  if (order.items && Array.isArray(order.items)) {
                    try {
                      const totals = calculateOrderTotals(order, [], []);
                      return getDisplayTotal(order, totals);
                    } catch (e) {
                      return Number(order.totalWithDelivery) || fallbackTotal;
                    }
                  }
                  return Number(order.totalWithDelivery) || fallbackTotal;
                })(),
                deliveryFee: isNaN(fee) ? 0 : fee,
                subtotal: itemsTotal,
                address: order.address?.fullAddress || order.address?.completeAddress || order.address?.address || null,
                area: order.address?.area || null,
                nickname: order.address?.nickname || null,
                city: order.address?.city || null,
                deliveryMethod: order.deliveryMethod || order.type || order.paymentMethod?.name || null,
                note: order.note || order.instructions || order.address?.instructions || null,
                paymentMethodId: order.paymentMethod?.id || null,
                paymentMethodName: order.paymentMethod?.name || null,
                paymentMethodDescription: order.paymentMethod?.description || null
              }
            };
          }
        }
      } catch (e) {
        console.error('Erreur enrichissement paiement', payment.id, e);
      }
      return {
        ...payment,
        orderData: {
          customerName: 'Client inconnu',
          customerPhone: null,
          items: [],
          totalItems: 0,
          restaurant: 'Restaurant inconnu',
          orderNumber: payment.orderId?.slice(-6) || 'N/A'
        }
      };
    })
  );
  return enriched;
}

export async function syncPaymentsWithOrders() {
  // Récupérer commandes non payées
  const unpaidOrders = await optimizedQuery('orders', {
    where: [['isPaid', '==', false]],
    useCache: false
  });

  for (const order of unpaidOrders) {
    try {
      // Chercher paiement existant
      const paymentsForOrder = await optimizedQuery('payments', {
        where: [['orderId', '==', order.id]],
        limit: 1,
        useCache: false
      });

      if (paymentsForOrder.length === 0) {
        // Compute robust amount
        const items = Array.isArray(order.items) ? order.items : [];
        const itemsTotal = items.reduce((sum, it) => {
          const unit = Number(
            it.price !== undefined ? it.price : (it.dishPrice !== undefined ? it.dishPrice : 0)
          );
          const q = Number(it.quantity || 1);
          return sum + (isNaN(unit) ? 0 : unit) * (isNaN(q) ? 1 : q);
        }, 0);
        const fee = Number(order.deliveryFee);
        const fallbackTotal = itemsTotal + (isNaN(fee) ? 0 : fee);
        let derivedAmount = 0;
        if (order.items && Array.isArray(order.items)) {
          try {
            const totals = calculateOrderTotals(order, [], []);
            derivedAmount = getDisplayTotal(order, totals);
          } catch (e) {
            derivedAmount = Number(order.totalWithDelivery) || Number(order.total) || fallbackTotal || 0;
          }
        } else {
          derivedAmount = Number(order.totalWithDelivery) || Number(order.total) || fallbackTotal || 0;
        }
        const customerName = order.contact?.name || order.customerName || 'Client inconnu';
        const customerPhone = order.contact?.phone || order.address?.phone || order.phone || null;
        const customerEmail = order.contact?.email || order.customerEmail || null;
        const paymentData = {
          orderId: order.id,
          amount: derivedAmount,
          currency: 'XOF',
          method: order.paymentMethod?.id || order.paymentMethod || 'unknown',
          status: 'false',
          customerEmail,
          customerName,
          customerPhone,
          description: `Commande #${order.id.slice(-6)}`,
          createdAt: order.timestamp || order.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now(),
          restaurantId: order.restaurantId,
          transactionId: `order_${order.id}`,
          syncedFromOrder: true
        };
        await addDoc(collection(db, 'payments'), paymentData);
      } else {
        const existingPayment = paymentsForOrder[0];
        if (existingPayment.status !== 'false' && !order.isPaid) {
          await updateDoc(doc(db, 'payments', existingPayment.id), {
            status: 'false',
            updatedAt: Timestamp.now()
          });
        }
      }
    } catch (e) {
      console.error('Erreur synchro paiement pour commande', order.id, e);
    }
  }
}

export async function updatePaymentStatusByOrder(orderId, isPaid) {
  const q = fsQuery(
    collection(db, 'payments'),
    fsWhere('orderId', '==', orderId),
    fsLimit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    const newStatus = isPaid ? 'completed' : 'false';
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: Timestamp.now(),
      paidAt: isPaid ? Timestamp.now() : null
    });
  }
}

export function subscribePaymentsRealtime({ dateRange = 'all', filterStatus = 'all', filterMethod = 'all', itemsPerPage = 50 } = {}, callback, errorCb) {
  const constraints = buildFsConstraints({ dateRange, filterStatus, filterMethod, itemsPerPage });
  const q = fsQuery(collection(db, 'payments'), ...constraints);
  const unsub = onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(payments);
  }, errorCb);
  return unsub;
}

export function subscribeOrdersStatus(callback, errorCb) {
  const q = fsQuery(collection(db, 'orders'), fsOrderBy('timestamp', 'desc'));
  const unsub = fsOnSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'modified') {
        const data = change.doc.data();
        const orderId = change.doc.id;
        if (Object.prototype.hasOwnProperty.call(data, 'isPaid')) {
          callback(orderId, data.isPaid);
        }
      }
    });
  }, errorCb);
  return unsub;
}

/**
 * Supprime définitivement les paiements et commandes de TEST.
 * Critères:
 *  - payment.orderId commence par 'test-order-'
 *  - payment.transactionId commence par 'test-transaction-'
 *  - commandes dont l'id est dans les orderId de test trouvés
 */
export async function deleteTestPaymentsAndOrders() {
  // Collecte des paiements de test par deux requêtes range (prefix)
  const paymentsCol = collection(db, 'payments');

  const range = (field, prefix) => fsQuery(
    paymentsCol,
    fsWhere(field, '>=', prefix),
    fsWhere(field, '<=', `${prefix}\uf8ff`)
  );

  const [byOrderSnap, byTxnSnap] = await Promise.all([
    getDocs(range('orderId', 'test-order-')),
    getDocs(range('transactionId', 'test-transaction-'))
  ]);

  // Fusionner uniques
  const toDeletePayments = new Map();
  byOrderSnap.forEach((d) => toDeletePayments.set(d.id, d));
  byTxnSnap.forEach((d) => toDeletePayments.set(d.id, d));

  if (toDeletePayments.size === 0) {
    return { paymentsDeleted: 0, ordersDeleted: 0 };
  }

  // Préparer batchs (limiter à ~400 écritures par batch pour marge)
  const docsArray = Array.from(toDeletePayments.values());
  let paymentsDeleted = 0;
  let ordersDeleted = 0;

  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));

  for (const group of chunk(docsArray, 400)) {
    const batch = writeBatch(db);
    const orderIdsToDelete = new Set();

    group.forEach((docSnap) => {
      const data = docSnap.data();
      const payRef = doc(db, 'payments', docSnap.id);
      batch.delete(payRef);
      paymentsDeleted += 1;
      const oid = data.orderId;
      if (typeof oid === 'string' && oid.startsWith('test-order-')) {
        orderIdsToDelete.add(oid);
      }
    });

    // Supprimer les commandes liées (si elles existent)
    orderIdsToDelete.forEach((oid) => {
      const ordRef = doc(db, 'orders', oid);
      batch.delete(ordRef);
      ordersDeleted += 1;
    });

    await batch.commit();
  }

  // Invalider le cache
  invalidateCache('payments');
  invalidateCache('orders');

  return { paymentsDeleted, ordersDeleted };
}

// ---------- Auto-creation from Orders (top-level) ----------

async function derivePaymentPayloadFromOrder(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsTotal = items.reduce((sum, it) => {
    const unit = Number(
      it.price !== undefined ? it.price : (it.dishPrice !== undefined ? it.dishPrice : 0)
    );
    const q = Number(it.quantity || 1);
    return sum + (isNaN(unit) ? 0 : unit) * (isNaN(q) ? 1 : q);
  }, 0);
  const fee = Number(order.deliveryFee);
  const fallbackTotal = itemsTotal + (isNaN(fee) ? 0 : fee);
  const derivedAmount = Number(order.totalWithDelivery) || Number(order.total) || fallbackTotal || 0;
  const customerName = order.contact?.name || order.customerName || 'Client inconnu';
  let customerPhone = order.contact?.phone || order.address?.phone || order.phone || null;
  if (!customerPhone && typeof order.userId === 'string' && order.userId.startsWith('guest-')) {
    const p = order.userId.slice(6);
    customerPhone = /^\d{6,}$/.test(p) ? p : null;
  }
  const customerEmail = order.contact?.email || order.customerEmail || null;

  return {
    orderId: order.id,
    amount: derivedAmount,
    currency: (order.currency || 'XOF').toUpperCase(),
    method: order.paymentMethod?.id || order.paymentMethod || 'unknown',
    status: order.isPaid ? 'completed' : 'false',
    customerEmail,
    customerName,
    customerPhone,
    description: `Commande #${String(order.id).slice(-6)}`,
    createdAt: order.timestamp || order.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
    restaurantId: order.restaurantId,
    transactionId: `order_${order.id}`,
    syncedFromOrder: true,
    // Facilité d'affichage côté UI
    orderData: {
      address: order.address?.fullAddress || order.address?.completeAddress || order.address?.address || null,
      area: order.address?.area || null,
      nickname: order.address?.nickname || null,
      city: order.address?.city || null,
      deliveryMethod: order.deliveryMethod || order.type || order.paymentMethod?.name || null,
      note: order.note || order.instructions || order.address?.instructions || null,
      paymentMethodId: order.paymentMethod?.id || null,
      paymentMethodName: order.paymentMethod?.name || null,
      paymentMethodDescription: order.paymentMethod?.description || null
    }
  };
}

async function ensurePaymentForOrder(order) {
  const existing = await optimizedQuery('payments', {
    where: [['orderId', '==', order.id]],
    limit: 1,
    useCache: false,
  });
  if (existing.length > 0) {
    const current = existing[0];
    const shouldStatus = order.isPaid ? 'completed' : 'false';
    if (current.status !== shouldStatus) {
      await updateDoc(doc(db, 'payments', current.id), {
        status: shouldStatus,
        updatedAt: Timestamp.now(),
        paidAt: order.isPaid ? Timestamp.now() : null,
      });
      invalidateCache('payments');
    }
    return { created: false, id: current.id };
  }
  const payload = await derivePaymentPayloadFromOrder(order);
  await addDoc(collection(db, 'payments'), payload);
  invalidateCache('payments');
  return { created: true };
}

export async function backfillPaymentsFromOrders() {
  const orders = await optimizedQuery('orders', {
    orderBy: [['timestamp', 'desc']],
    limit: 1000,
    useCache: false,
  });
  let created = 0;
  for (const order of orders) {
    const res = await ensurePaymentForOrder(order);
    if (res.created) created += 1;
  }
  return { created };
}

export async function backfillPaymentsForRange(startDate, endDate) {
  // startDate and endDate are JS Date objects (inclusive range)
  // Fetch by both 'timestamp' and 'createdAt' to cover all historical orders
  const ordersCol = collection(db, 'orders');
  const queries = [];
  if (startDate && endDate) {
    queries.push(
      fsQuery(ordersCol, fsWhere('timestamp', '>=', startDate), fsWhere('timestamp', '<=', endDate))
    );
    queries.push(
      fsQuery(ordersCol, fsWhere('createdAt', '>=', startDate), fsWhere('createdAt', '<=', endDate))
    );
  } else if (startDate) {
    queries.push(fsQuery(ordersCol, fsWhere('timestamp', '>=', startDate)));
    queries.push(fsQuery(ordersCol, fsWhere('createdAt', '>=', startDate)));
  } else if (endDate) {
    queries.push(fsQuery(ordersCol, fsWhere('timestamp', '<=', endDate)));
    queries.push(fsQuery(ordersCol, fsWhere('createdAt', '<=', endDate)));
  } else {
    // No date limit: scan recent orders as fallback
    queries.push(fsQuery(ordersCol, fsOrderBy('timestamp', 'desc'), fsLimit(1000)));
  }

  const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
  const byId = new Map();
  snapshots.forEach((snap) => {
    snap.forEach((docSnap) => {
      const id = docSnap.id;
      if (!byId.has(id)) {
        byId.set(id, { id, ...docSnap.data() });
      }
    });
  });

  const orders = Array.from(byId.values());
  let created = 0;
  for (const order of orders) {
    const res = await ensurePaymentForOrder(order);
    if (res.created) created += 1;
  }
  return { created, scanned: orders.length };
}

export async function backfillPaymentsForCurrentMonth() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return await backfillPaymentsForRange(startOfMonth, endOfMonth);
}

// Backfill complet : créer tous les paiements manquants pour toutes les commandes
export async function backfillAllPayments() {
  const ordersCol = collection(db, 'orders');
  const queries = [
    fsQuery(ordersCol, fsOrderBy('timestamp', 'desc'), fsLimit(2000)),
    fsQuery(ordersCol, fsOrderBy('createdAt', 'desc'), fsLimit(2000))
  ];

  const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
  const byId = new Map();
  snapshots.forEach((snap) => {
    snap.forEach((docSnap) => {
      const id = docSnap.id;
      if (!byId.has(id)) {
        byId.set(id, { id, ...docSnap.data() });
      }
    });
  });

  const orders = Array.from(byId.values());
  let created = 0;
  for (const order of orders) {
    const res = await ensurePaymentForOrder(order);
    if (res.created) created += 1;
  }
  return { created, scanned: orders.length };
}

export function subscribeNewOrdersCreatePayments(errorCb) {
  const q = fsQuery(collection(db, 'orders'), fsOrderBy('timestamp', 'desc'));
  const unsub = fsOnSnapshot(q, async (snapshot) => {
    const added = snapshot.docChanges().filter((c) => c.type === 'added');
    for (const change of added) {
      const order = { id: change.doc.id, ...change.doc.data() };
      try {
        await ensurePaymentForOrder(order);
      } catch (e) {
        console.error('Erreur création paiement pour nouvelle commande', order.id, e);
        if (errorCb) errorCb(e);
      }
    }
  }, errorCb);
  return unsub;
}
