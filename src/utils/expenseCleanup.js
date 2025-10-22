import { db } from '../firebase';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';

// Système de classification cohérent
const CLASSIFICATION_SYSTEM = {
  DEPARTMENTS: {
    'magedabord': {
      label: '🍽️ Maged\'Abord',
      description: 'Restaurant principal - Plats traditionnels',
      color: '#EF4444',
      icon: '🍽️'
    },
    'crunch': {
      label: '🥪 Crunch',
      description: 'Restaurant secondaire - Snacks et boissons',
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
  },
  CATEGORIES: {
    'ingredients': {
      label: '🥬 Ingrédients',
      description: 'Achats d\'ingrédients et matières premières',
      departments: ['magedabord', 'crunch']
    },
    'equipment': {
      label: '🔧 Équipement',
      description: 'Achat et maintenance d\'équipements',
      departments: ['magedabord', 'crunch', 'square']
    },
    'utilities': {
      label: '⚡ Services publics',
      description: 'Électricité, eau, gaz, internet',
      departments: ['magedabord', 'crunch', 'divers']
    },
    'delivery': {
      label: '🚚 Livraison',
      description: 'Carburant, entretien véhicules, frais de livraison',
      departments: ['square']
    },
    'staff': {
      label: '👥 Personnel',
      description: 'Salaires, primes, formations',
      departments: ['magedabord', 'crunch', 'square']
    },
    'marketing': {
      label: '📢 Marketing',
      description: 'Publicité, promotions, communication',
      departments: ['magedabord', 'crunch', 'divers']
    },
    'rent': {
      label: '🏠 Loyer',
      description: 'Loyers des locaux',
      departments: ['magedabord', 'crunch', 'square']
    },
    'insurance': {
      label: '🛡️ Assurances',
      description: 'Assurances diverses',
      departments: ['magedabord', 'crunch', 'square', 'divers']
    },
    'other': {
      label: '📋 Autres',
      description: 'Dépenses diverses non classées',
      departments: ['divers']
    }
  }
};

// Fonction de classification automatique
export const classifyExpense = (expense) => {
  let department = 'divers';
  let category = 'other';
  
  const description = (expense.description || '').toLowerCase();
  const supplier = (expense.supplier || expense.supplierName || '').toLowerCase();
  const combinedText = `${description} ${supplier}`.toLowerCase();
  
  // Classification par type de dépense
  if (expense.type === 'delivery') {
    department = 'square';
    category = 'delivery';
  } else if (expense.type === 'purchase') {
    // Analyser la description pour déterminer le département
    if (combinedText.includes('ingrédient') || combinedText.includes('aliment') || 
        combinedText.includes('viande') || combinedText.includes('poisson') ||
        combinedText.includes('légume') || combinedText.includes('épice') ||
        combinedText.includes('condiment') || combinedText.includes('assaisonnement')) {
      department = 'magedabord';
      category = 'ingredients';
    } else if (combinedText.includes('snack') || combinedText.includes('boisson') || 
               combinedText.includes('jus') || combinedText.includes('soda') ||
               combinedText.includes('chips') || combinedText.includes('biscuit')) {
      department = 'crunch';
      category = 'ingredients';
    } else if (combinedText.includes('équipement') || combinedText.includes('machine') || 
               combinedText.includes('cuisine') || combinedText.includes('four') ||
               combinedText.includes('réfrigérateur') || combinedText.includes('congélateur')) {
      department = 'magedabord';
      category = 'equipment';
    } else {
      department = 'divers';
      category = 'other';
    }
  } else if (expense.type === 'expense') {
    // Utiliser le département existant ou classifier automatiquement
    const existingDept = expense.department?.toLowerCase();
    if (existingDept && CLASSIFICATION_SYSTEM.DEPARTMENTS[existingDept]) {
      department = existingDept;
    } else {
      // Classification automatique basée sur la description
      if (combinedText.includes('livraison') || combinedText.includes('carburant') || 
          combinedText.includes('véhicule') || combinedText.includes('moto') ||
          combinedText.includes('essence') || combinedText.includes('gasoil')) {
        department = 'square';
        category = 'delivery';
      } else if (combinedText.includes('salair') || combinedText.includes('personnel') || 
                 combinedText.includes('employé') || combinedText.includes('prime') ||
                 combinedText.includes('formation') || combinedText.includes('salaire')) {
        department = 'magedabord';
        category = 'staff';
      } else if (combinedText.includes('loyer') || combinedText.includes('location') ||
                 combinedText.includes('bail') || combinedText.includes('propriétaire')) {
        department = 'magedabord';
        category = 'rent';
      } else if (combinedText.includes('électricité') || combinedText.includes('eau') || 
                 combinedText.includes('gaz') || combinedText.includes('internet') ||
                 combinedText.includes('téléphone') || combinedText.includes('électricité')) {
        department = 'magedabord';
        category = 'utilities';
      } else if (combinedText.includes('publicité') || combinedText.includes('marketing') ||
                 combinedText.includes('promotion') || combinedText.includes('communication') ||
                 combinedText.includes('affiche') || combinedText.includes('flyer')) {
        department = 'magedabord';
        category = 'marketing';
      } else if (combinedText.includes('assurance') || combinedText.includes('sécurité') ||
                 combinedText.includes('protection')) {
        department = 'magedabord';
        category = 'insurance';
      } else {
        department = 'divers';
        category = 'other';
      }
    }
  }

  return { department, category };
};

// Fonction pour nettoyer et classifier toutes les dépenses
export const cleanupAndClassifyAllExpenses = async () => {
  try {
    console.log('🧹 Début du nettoyage et de la classification des dépenses...');
    
    const results = {
      expenses: { processed: 0, updated: 0, errors: 0 },
      purchases: { processed: 0, updated: 0, errors: 0 },
      deliveryExpenses: { processed: 0, updated: 0, errors: 0 },
      purchaseLists: { processed: 0, updated: 0, errors: 0 },
      ingredients: { processed: 0, updated: 0, errors: 0 }
    };

    // Traiter les dépenses générales
    console.log('📋 Traitement des dépenses générales...');
    const expensesQuery = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const expensesSnapshot = await getDocs(expensesQuery);
    
    for (const docSnapshot of expensesSnapshot.docs) {
      try {
        results.expenses.processed++;
        const expense = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Classifier la dépense
        const { department, category } = classifyExpense(expense);
        
        // Vérifier si la classification est différente de l'existante
        if (expense.classifiedDepartment !== department || expense.classifiedCategory !== category) {
          await updateDoc(doc(db, 'expenses', docSnapshot.id), {
            classifiedDepartment: department,
            classifiedCategory: category,
            lastClassificationUpdate: new Date()
          });
          results.expenses.updated++;
          console.log(`✅ Dépense ${docSnapshot.id} classifiée: ${department} - ${category}`);
        }
      } catch (error) {
        results.expenses.errors++;
        console.error(`❌ Erreur pour la dépense ${docSnapshot.id}:`, error);
      }
    }

    // Traiter les achats
    console.log('🛒 Traitement des achats...');
    const purchasesQuery = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
    const purchasesSnapshot = await getDocs(purchasesQuery);
    
    for (const docSnapshot of purchasesSnapshot.docs) {
      try {
        results.purchases.processed++;
        const purchase = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Classifier l'achat
        const { department, category } = classifyExpense(purchase);
        
        // Vérifier si la classification est différente de l'existante
        if (purchase.classifiedDepartment !== department || purchase.classifiedCategory !== category) {
          await updateDoc(doc(db, 'purchases', docSnapshot.id), {
            classifiedDepartment: department,
            classifiedCategory: category,
            lastClassificationUpdate: new Date()
          });
          results.purchases.updated++;
          console.log(`✅ Achat ${docSnapshot.id} classifié: ${department} - ${category}`);
        }
      } catch (error) {
        results.purchases.errors++;
        console.error(`❌ Erreur pour l'achat ${docSnapshot.id}:`, error);
      }
    }

    // Traiter les dépenses de livraison
    console.log('🚚 Traitement des dépenses de livraison...');
    const deliveryQuery = query(collection(db, 'deliveryExpenses'), orderBy('createdAt', 'desc'));
    const deliverySnapshot = await getDocs(deliveryQuery);
    
    for (const docSnapshot of deliverySnapshot.docs) {
      try {
        results.deliveryExpenses.processed++;
        const deliveryExpense = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Classifier la dépense de livraison
        const { department, category } = classifyExpense(deliveryExpense);
        
        // Vérifier si la classification est différente de l'existante
        if (deliveryExpense.classifiedDepartment !== department || deliveryExpense.classifiedCategory !== category) {
          await updateDoc(doc(db, 'deliveryExpenses', docSnapshot.id), {
            classifiedDepartment: department,
            classifiedCategory: category,
            lastClassificationUpdate: new Date()
          });
          results.deliveryExpenses.updated++;
          console.log(`✅ Dépense livraison ${docSnapshot.id} classifiée: ${department} - ${category}`);
        }
      } catch (error) {
        results.deliveryExpenses.errors++;
        console.error(`❌ Erreur pour la dépense livraison ${docSnapshot.id}:`, error);
      }
    }

    // Traiter les listes d'achats (purchaseLists) - Achats de cuisine
    console.log('🛒 Traitement des listes d\'achats de cuisine...');
    const purchaseListsQuery = query(collection(db, 'purchaseLists'), orderBy('date', 'desc'));
    const purchaseListsSnapshot = await getDocs(purchaseListsQuery);
    
    for (const docSnapshot of purchaseListsSnapshot.docs) {
      try {
        results.purchaseLists.processed++;
        const purchaseList = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Classifier la liste d'achat (toujours ingrédients pour la cuisine)
        const { department, category } = classifyExpense({
          ...purchaseList,
          type: 'purchase',
          description: `Liste d'achat cuisine - ${purchaseList.brands?.join(', ') || 'Divers'}`
        });
        
        // Vérifier si la classification est différente de l'existante
        if (purchaseList.classifiedDepartment !== department || purchaseList.classifiedCategory !== category) {
          await updateDoc(doc(db, 'purchaseLists', docSnapshot.id), {
            classifiedDepartment: department,
            classifiedCategory: category,
            lastClassificationUpdate: new Date()
          });
          results.purchaseLists.updated++;
          console.log(`✅ Liste d'achat ${docSnapshot.id} classifiée: ${department} - ${category}`);
        }
      } catch (error) {
        results.purchaseLists.errors++;
        console.error(`❌ Erreur pour la liste d'achat ${docSnapshot.id}:`, error);
      }
    }

    // Traiter les ingrédients (coûts unitaires)
    console.log('🥬 Traitement des coûts des ingrédients...');
    const ingredientsQuery = query(collection(db, 'ingredients'), orderBy('name'));
    const ingredientsSnapshot = await getDocs(ingredientsQuery);
    
    for (const docSnapshot of ingredientsSnapshot.docs) {
      try {
        results.ingredients.processed++;
        const ingredient = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Classifier l'ingrédient (toujours ingrédients)
        const { department, category } = classifyExpense({
          ...ingredient,
          type: 'purchase',
          description: `Ingrédient: ${ingredient.name}`,
          amount: ingredient.unitPrice || 0
        });
        
        // Vérifier si la classification est différente de l'existante
        if (ingredient.classifiedDepartment !== department || ingredient.classifiedCategory !== category) {
          await updateDoc(doc(db, 'ingredients', docSnapshot.id), {
            classifiedDepartment: department,
            classifiedCategory: category,
            lastClassificationUpdate: new Date()
          });
          results.ingredients.updated++;
          console.log(`✅ Ingrédient ${docSnapshot.id} classifié: ${department} - ${category}`);
        }
      } catch (error) {
        results.ingredients.errors++;
        console.error(`❌ Erreur pour l'ingrédient ${docSnapshot.id}:`, error);
      }
    }

    console.log('🎉 Nettoyage terminé !');
    console.log('📊 Résultats:', results);
    
    return results;
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  }
};

// Fonction pour détecter les doublons potentiels
export const detectDuplicates = async () => {
  try {
    console.log('🔍 Recherche des doublons potentiels...');
    
    const allExpenses = [];
    
    // Collecter toutes les dépenses
    const [expensesSnapshot, purchasesSnapshot, deliverySnapshot, purchaseListsSnapshot, ingredientsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'expenses'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'purchases'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'deliveryExpenses'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'purchaseLists'), orderBy('date', 'desc'))),
      getDocs(query(collection(db, 'ingredients'), orderBy('name')))
    ]);

    // Ajouter les dépenses générales
    expensesSnapshot.docs.forEach(doc => {
      allExpenses.push({ id: doc.id, ...doc.data(), source: 'expenses' });
    });

    // Ajouter les achats
    purchasesSnapshot.docs.forEach(doc => {
      allExpenses.push({ id: doc.id, ...doc.data(), source: 'purchases' });
    });

    // Ajouter les dépenses de livraison
    deliverySnapshot.docs.forEach(doc => {
      allExpenses.push({ id: doc.id, ...doc.data(), source: 'deliveryExpenses' });
    });

    // Ajouter les listes d'achats de cuisine
    purchaseListsSnapshot.docs.forEach(doc => {
      allExpenses.push({ 
        id: doc.id, 
        ...doc.data(), 
        source: 'purchaseLists',
        description: `Liste d'achat cuisine - ${doc.data().brands?.join(', ') || 'Divers'}`,
        amount: doc.data().total || 0
      });
    });

    // Ajouter les coûts des ingrédients
    ingredientsSnapshot.docs.forEach(doc => {
      allExpenses.push({ 
        id: doc.id, 
        ...doc.data(), 
        source: 'ingredients',
        description: `Ingrédient: ${doc.data().name}`,
        amount: doc.data().unitPrice || 0
      });
    });

    // Détecter les doublons potentiels
    const duplicates = [];
    const seen = new Map();

    allExpenses.forEach(expense => {
      const key = `${expense.description?.toLowerCase()}_${expense.amount}_${new Date(expense.createdAt).toDateString()}`;
      
      if (seen.has(key)) {
        duplicates.push({
          original: seen.get(key),
          duplicate: expense,
          similarity: 'high'
        });
      } else {
        seen.set(key, expense);
      }
    });

    console.log(`🔍 ${duplicates.length} doublons potentiels détectés`);
    return duplicates;
  } catch (error) {
    console.error('❌ Erreur lors de la détection des doublons:', error);
    throw error;
  }
};

// Fonction pour générer un rapport de cohérence
export const generateConsistencyReport = async () => {
  try {
    console.log('📊 Génération du rapport de cohérence...');
    
    const report = {
      totalExpenses: 0,
      byDepartment: {},
      byCategory: {},
      bySource: {},
      unclassified: 0,
      needsReview: 0,
      duplicates: 0
    };

    // Collecter toutes les dépenses
    const [expensesSnapshot, purchasesSnapshot, deliverySnapshot, purchaseListsSnapshot, ingredientsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'expenses'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'purchases'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'deliveryExpenses'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'purchaseLists'), orderBy('date', 'desc'))),
      getDocs(query(collection(db, 'ingredients'), orderBy('name')))
    ]);

    const allExpenses = [];

    // Ajouter toutes les dépenses
    expensesSnapshot.docs.forEach(doc => {
      allExpenses.push({ id: doc.id, ...doc.data(), source: 'expenses' });
    });
    purchasesSnapshot.docs.forEach(doc => {
      allExpenses.push({ id: doc.id, ...doc.data(), source: 'purchases' });
    });
    deliverySnapshot.docs.forEach(doc => {
      allExpenses.push({ id: doc.id, ...doc.data(), source: 'deliveryExpenses' });
    });
    purchaseListsSnapshot.docs.forEach(doc => {
      allExpenses.push({ 
        id: doc.id, 
        ...doc.data(), 
        source: 'purchaseLists',
        description: `Liste d'achat cuisine - ${doc.data().brands?.join(', ') || 'Divers'}`,
        amount: doc.data().total || 0
      });
    });
    ingredientsSnapshot.docs.forEach(doc => {
      allExpenses.push({ 
        id: doc.id, 
        ...doc.data(), 
        source: 'ingredients',
        description: `Ingrédient: ${doc.data().name}`,
        amount: doc.data().unitPrice || 0
      });
    });

    report.totalExpenses = allExpenses.length;

    // Analyser par département et catégorie
    allExpenses.forEach(expense => {
      const department = expense.classifiedDepartment || 'unclassified';
      const category = expense.classifiedCategory || 'unclassified';
      const source = expense.source || 'unknown';
      const amount = Number(expense.amount || expense.total || 0);

      // Compter par département
      if (!report.byDepartment[department]) {
        report.byDepartment[department] = { count: 0, total: 0 };
      }
      report.byDepartment[department].count++;
      report.byDepartment[department].total += amount;

      // Compter par catégorie
      if (!report.byCategory[category]) {
        report.byCategory[category] = { count: 0, total: 0 };
      }
      report.byCategory[category].count++;
      report.byCategory[category].total += amount;

      // Compter par source
      if (!report.bySource[source]) {
        report.bySource[source] = { count: 0, total: 0 };
      }
      report.bySource[source].count++;
      report.bySource[source].total += amount;

      // Compter les non classifiés
      if (department === 'unclassified' || category === 'unclassified') {
        report.unclassified++;
      }

      // Compter ceux qui ont besoin de révision
      if (expense.needsReview) {
        report.needsReview++;
      }
    });

    // Détecter les doublons
    const duplicates = await detectDuplicates();
    report.duplicates = duplicates.length;

    console.log('📊 Rapport de cohérence généré:', report);
    return report;
  } catch (error) {
    console.error('❌ Erreur lors de la génération du rapport:', error);
    throw error;
  }
};

export { CLASSIFICATION_SYSTEM };

export default {
  classifyExpense,
  cleanupAndClassifyAllExpenses,
  detectDuplicates,
  generateConsistencyReport,
  CLASSIFICATION_SYSTEM
};
