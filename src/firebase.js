// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
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
  throw error;
}

// Initialisation des services
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Activer la persistance hors ligne pour Firestore
let persistenceInitialized = false;

enableIndexedDbPersistence(db)
  .then(() => {
    persistenceInitialized = true;
    console.log("Persistance hors ligne activée avec succès.");
  })
  .catch((err) => {
    persistenceInitialized = true;
    if (err.code === "failed-precondition") {
      console.warn("La persistance hors ligne ne peut être activée que dans un seul onglet à la fois.");
    } else if (err.code === "unimplemented") {
      console.warn("La persistance hors ligne n'est pas prise en charge par ce navigateur.");
    } else {
      console.error("Erreur lors de l'activation de la persistance hors ligne :", err);
    }
  });

// Initialisation de messaging avec gestion de compatibilité
let messaging = null;

isSupported()
  .then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
      console.log("Firebase Messaging initialisé.");
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
        resolve();
      }
    }, 100);
  });
};

export { db, storage, auth, googleProvider, messaging, isSupported, waitForPersistence };