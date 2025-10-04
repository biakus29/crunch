import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';

/**
 * Script pour créer les comptes des livreurs existants
 * À exécuter une seule fois pour initialiser les livreurs
 */

const DELIVERERS_DATA = [
  {
    name: "Boris",
    phone: "+237 6XX XX XX XX", // À compléter
    email: "boris.livreur@crunch.com",
    vehicleType: "moto",
    vehicleNumber: "",
    zone: "Douala",
    active: true
  },
  {
    name: "Cyriac",
    phone: "+237 6XX XX XX XX", // À compléter
    email: "cyriac.livreur@crunch.com",
    vehicleType: "moto",
    vehicleNumber: "",
    zone: "Douala",
    active: true
  },
  {
    name: "Serge",
    phone: "+237 6XX XX XX XX", // À compléter
    email: "serge.livreur@crunch.com",
    vehicleType: "moto",
    vehicleNumber: "",
    zone: "Douala",
    active: true
  },
  {
    name: "Ismaël",
    phone: "+237 6XX XX XX XX", // À compléter
    email: "ismael.livreur@crunch.com",
    vehicleType: "moto",
    vehicleNumber: "",
    zone: "Douala",
    active: true
  },
  {
    name: "Joël",
    phone: "+237 6XX XX XX XX", // À compléter
    email: "joel.livreur@crunch.com",
    vehicleType: "moto",
    vehicleNumber: "",
    zone: "Douala",
    active: true
  },
  {
    name: "Patrick",
    phone: "+237 6XX XX XX XX", // À compléter
    email: "patrick.livreur@crunch.com",
    vehicleType: "moto",
    vehicleNumber: "",
    zone: "Douala",
    active: true
  },
  {
    name: "Abdoulaye",
    phone: "+237 6XX XX XX XX", // À compléter
    email: "abdoulaye.livreur@crunch.com",
    vehicleType: "moto",
    vehicleNumber: "",
    zone: "Douala",
    active: true
  },
  {
    name: "Franck",
    phone: "+237 6XX XX XX XX", // À compléter
    email: "franck.livreur@crunch.com",
    vehicleType: "moto",
    vehicleNumber: "",
    zone: "Douala",
    active: true
  }
];

/**
 * Créer les comptes livreurs dans Firestore
 * @param {string} restaurantId - ID du restaurant
 */
export const createDeliverersAccounts = async (restaurantId) => {
  try {

    if (!restaurantId) {
      throw new Error('Restaurant ID requis');
    }

    let created = 0;
    let skipped = 0;

    for (const deliverer of DELIVERERS_DATA) {

      // Vérifier si le livreur existe déjà
      const existingQuery = query(
        collection(db, 'deliverers'),
        where('name', '==', deliverer.name),
        where('restaurantId', '==', restaurantId)
      );
      
      const existingDocs = await getDocs(existingQuery);
      
      if (!existingDocs.empty) {

        skipped++;
        continue;
      }

      // Créer le compte livreur
      const docRef = await addDoc(collection(db, 'deliverers'), {
        ...deliverer,
        restaurantId,
        totalDeliveries: 0,
        rating: 0,
        earnings: 0,
        createdAt: serverTimestamp()
      });

      created++;
    }

    return {
      success: true,
      created,
      skipped,
      total: DELIVERERS_DATA.length
    };

  } catch (error) {
    console.error('❌ Erreur lors de la création des livreurs:', error);
    throw error;
  }
};

/**
 * Créer aussi dans la collection employees pour compatibilité
 * @param {string} restaurantId - ID du restaurant
 */
export const createDeliverersInEmployees = async (restaurantId) => {
  try {

    if (!restaurantId) {
      throw new Error('Restaurant ID requis');
    }

    let created = 0;
    let skipped = 0;

    for (const deliverer of DELIVERERS_DATA) {
      // Vérifier si existe déjà
      const existingQuery = query(
        collection(db, 'employees'),
        where('name', '==', deliverer.name),
        where('restaurantId', '==', restaurantId),
        where('role', '==', 'livreur')
      );
      
      const existingDocs = await getDocs(existingQuery);
      
      if (!existingDocs.empty) {

        skipped++;
        continue;
      }

      // Créer dans employees
      await addDoc(collection(db, 'employees'), {
        name: deliverer.name,
        role: 'livreur',
        email: deliverer.email,
        phone: deliverer.phone,
        restaurantId,
        createdAt: serverTimestamp()
      });

      created++;
    }

    return {
      success: true,
      created,
      skipped
    };

  } catch (error) {
    console.error('❌ Erreur lors de la création dans employees:', error);
    throw error;
  }
};

/**
 * Fonction principale pour tout créer
 * @param {string} restaurantId - ID du restaurant
 */
export const initializeDeliverers = async (restaurantId) => {
  try {

    // Créer dans deliverers
    const deliverersResult = await createDeliverersAccounts(restaurantId);

    // Créer dans employees pour compatibilité
    const employeesResult = await createDeliverersInEmployees(restaurantId);

    return {
      success: true,
      deliverers: deliverersResult,
      employees: employeesResult
    };
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    throw error;
  }
};

// Export des données pour utilisation ailleurs
export { DELIVERERS_DATA };
