// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getMessaging, isSupported } from "firebase/messaging";

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDlrQAdJLoJTeG3S5LakaHFwWrCCcz7cEA",
  authDomain: "papersbook-f3826.firebaseapp.com",
  projectId: "papersbook-f3826",
  storageBucket: "papersbook-f3826.appspot.com",
  messagingSenderId: "232506897629",
  appId: "1:232506897629:web:ff1d449742444c7d4d9734",
  measurementId: "G-JL47RHZXV5",
};

// Initialisation de l'application Firebase avec gestion des erreurs
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialisé avec succès");
} catch (error) {
  console.error("Erreur lors de l'initialisation de Firebase :", error);
  // Ne pas throw l'erreur pour éviter de casser l'app
  // Créer une instance de fallback
  app = null;
}

// Initialisation des services avec gestion d'erreurs
let db, storage, auth, googleProvider, rtdb;

if (app) {
  try {
    db = getFirestore(app);
    rtdb = getDatabase(app);
    storage = getStorage(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log("Services Firebase initialisés avec succès");
  } catch (error) {
    console.error("Erreur lors de l'initialisation des services Firebase :", error);
    // Créer des instances de fallback
    db = null;
    rtdb = null;
    storage = null;
    auth = null;
    googleProvider = null;
  }
} else {
  console.warn("Firebase non initialisé, services non disponibles");
  db = null;
  storage = null;
  auth = null;
  googleProvider = null;
  rtdb = null;
}

// Persistance hors ligne désactivée temporairement pour éviter les erreurs d'assertion interne
let persistenceInitialized = true;
// Optionnel: Réactiver la persistance si nécessaire
// enableIndexedDbPersistence(db)
//   .then(() => {
//     persistenceInitialized = true;
//     console.log("Persistance hors ligne activée avec succès.");
//   })
//   .catch((err) => {
//     persistenceInitialized = true;
//     if (err.code === "failed-precondition") {
//       console.warn("La persistance hors ligne ne peut être activée que dans un seul onglet à la fois.");
//     } else if (err.code === "unimplemented") {
//       console.warn("La persistance hors ligne n'est pas prise en charge par ce navigateur.");
//     } else {
//       console.error("Erreur lors de l'activation de la persistance hors ligne :", err);
//     }
//   });

// Initialisation de messaging avec gestion de compatibilité
let messaging = null;

isSupported()
  .then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    } else {
      console.warn("Firebase Messaging non supporté sur ce navigateur.");
    }
  })
  .catch((err) => {
    console.error("Erreur de détection de support Firebase Messaging :", err);
  });

// Fonction utilitaire pour attendre l'initialisation de la persistance
const waitForPersistence = async () => {
  if (persistenceInitialized) return;
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (persistenceInitialized) {
        clearInterval(checkInterval);
      }
    }, 100);
  });
};

export { db, rtdb, storage, auth, googleProvider, messaging, isSupported, waitForPersistence };