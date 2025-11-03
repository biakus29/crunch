import { db } from '../firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';

// Script pour analyser et corriger les doublons dans les sorties comptables
export const analyzeAndFixAccountingDuplicates = async () => {
  try {
    console.log('🔍 Analyse des doublons dans les sorties comptables...');

    // Charger toutes les données pertinentes
    const [expensesSnap, purchasesSnap, purchaseListsSnap] = await Promise.all([
      getDocs(query(collection(db, 'expenses'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'purchases'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'purchaseLists'), orderBy('date', 'desc')))
    ]);

    const expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'expenses' }));
    const purchases = purchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'purchases' }));
    const purchaseLists = purchaseListsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'purchaseLists' }));

    console.log(`📊 Données chargées:
      - Expenses: ${expenses.length}
      - Purchases: ${purchases.length}
      - PurchaseLists: ${purchaseLists.length}`);

    // 1. Détecter les doublons dans les purchases (même collection)
    const purchaseDuplicates = findDuplicatesInCollection(purchases, ['description', 'amount', 'createdAt']);
    console.log(`🔄 Doublons dans purchases: ${purchaseDuplicates.length}`);

    // 2. Détecter les achats qui existent à la fois dans purchases et purchaseLists
    const crossCollectionDuplicates = findCrossCollectionDuplicates(purchases, purchaseLists);
    console.log(`🔄 Doublons entre collections: ${crossCollectionDuplicates.length}`);

    // 3. Détecter les doublons dans expenses
    const expenseDuplicates = findDuplicatesInCollection(expenses, ['description', 'amount', 'createdAt']);
    console.log(`🔄 Doublons dans expenses: ${expenseDuplicates.length}`);

    const report = {
      purchaseDuplicates,
      crossCollectionDuplicates,
      expenseDuplicates,
      totalDuplicates: purchaseDuplicates.length + crossCollectionDuplicates.length + expenseDuplicates.length
    };

    console.log('📋 Rapport d\'analyse terminé:', report);
    return report;

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
    toast.error('Erreur lors de l\'analyse des doublons');
    throw error;
  }
};

// Fonction pour trouver les doublons dans une même collection
const findDuplicatesInCollection = (items, compareFields) => {
  const duplicates = [];
  const seen = new Map();

  items.forEach(item => {
    // Créer une clé de comparaison basée sur les champs spécifiés
    const key = compareFields.map(field => {
      if (field === 'createdAt') {
        const date = item.createdAt?.toDate?.() || new Date(item.createdAt);
        return date.toDateString(); // Comparer seulement la date, pas l'heure
      }
      return (item[field] || '').toString().toLowerCase().trim();
    }).join('_');

    if (seen.has(key)) {
      duplicates.push({
        original: seen.get(key),
        duplicate: item,
        key: key
      });
    } else {
      seen.set(key, item);
    }
  });

  return duplicates;
};

// Fonction pour trouver les doublons entre collections purchases et purchaseLists
const findCrossCollectionDuplicates = (purchases, purchaseLists) => {
  const duplicates = [];

  purchaseLists.forEach(purchaseList => {
    const purchaseListTotal = purchaseList.total || 0;
    const purchaseListDate = purchaseList.date || purchaseList.createdAt;

    // Chercher des achats similaires dans purchases
    const similarPurchases = purchases.filter(purchase => {
      const purchaseAmount = purchase.amount || purchase.total || 0;
      const purchaseDate = purchase.createdAt?.toDate?.() || new Date(purchase.createdAt);

      // Comparer le montant (avec une tolérance de 1%)
      const amountMatch = Math.abs(purchaseAmount - purchaseListTotal) / purchaseListTotal < 0.01;

      // Comparer les dates (même jour)
      const dateMatch = purchaseDate.toDateString() === new Date(purchaseListDate).toDateString();

      // Comparer la description si elle existe
      const descMatch = purchase.description && purchaseList.brands &&
        purchase.description.toLowerCase().includes(purchaseList.brands.join(' ').toLowerCase());

      return amountMatch && dateMatch && (descMatch || !purchase.description);
    });

    similarPurchases.forEach(similar => {
      duplicates.push({
        purchaseListItem: purchaseList,
        purchaseItem: similar
      });
    });
  });

  return duplicates;
};

// Fonction pour supprimer les doublons identifiés
export const removeIdentifiedDuplicates = async (duplicatesReport) => {
  try {
    console.log('🗑️ Suppression des doublons identifiés...');

    let deletedCount = 0;

    // Supprimer les doublons dans purchases
    for (const duplicate of duplicatesReport.purchaseDuplicates) {
      await deleteDoc(doc(db, 'purchases', duplicate.duplicate.id));
      deletedCount++;
    }

    // Supprimer les doublons cross-collection (conserver purchaseLists, supprimer purchases)
    for (const duplicate of duplicatesReport.crossCollectionDuplicates) {
      await deleteDoc(doc(db, 'purchases', duplicate.purchaseItem.id));
      deletedCount++;
    }

    // Supprimer les doublons dans expenses
    for (const duplicate of duplicatesReport.expenseDuplicates) {
      await deleteDoc(doc(db, 'expenses', duplicate.duplicate.id));
      deletedCount++;
    }

    console.log(`✅ ${deletedCount} doublons supprimés`);
    toast.success(`${deletedCount} doublons supprimés avec succès`);

    return deletedCount;

  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    toast.error('Erreur lors de la suppression des doublons');
    throw error;
  }
};

// Fonction principale pour exécuter l'analyse et le nettoyage
export const fixAccountingDuplicates = async () => {
  try {
    const report = await analyzeAndFixAccountingDuplicates();

    if (report.totalDuplicates > 0) {
      const confirmDelete = window.confirm(
        `🔍 ${report.totalDuplicates} doublons détectés.\n\n` +
        `Détails:\n` +
        `- Doublons dans purchases: ${report.purchaseDuplicates.length}\n` +
        `- Doublons cross-collection: ${report.crossCollectionDuplicates.length}\n` +
        `- Doublons dans expenses: ${report.expenseDuplicates.length}\n\n` +
        `Voulez-vous supprimer automatiquement ces doublons ?`
      );

      if (confirmDelete) {
        const deletedCount = await removeIdentifiedDuplicates(report);
        return { success: true, deletedCount, report };
      } else {
        return { success: false, report, message: 'Suppression annulée par l\'utilisateur' };
      }
    } else {
      toast.success('Aucun doublon détecté dans les sorties comptables');
      return { success: true, deletedCount: 0, report };
    }

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    toast.error('Erreur lors du nettoyage des doublons');
    throw error;
  }
};




