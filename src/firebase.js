// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Import du stockage
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Ajoutez GoogleAuthProvider

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDlrQAdJLoJTeG3S5LakaHFwWrCCcz7cEA",
  authDomain: "papersbook-f3826.firebaseapp.com",
  projectId: "papersbook-f3826",
  storageBucket: "papersbook-f3826.appspot.com",
  messagingSenderId: "232506897629",
  appId: "1:232506897629:web:ff1d449742444c7d4d9734",
  measurementId: "G-JL47RHZXV5"
};
  
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();  // Initialisation du fournisseur Google

export { db, storage, auth, googleProvider };
