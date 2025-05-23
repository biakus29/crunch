import { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import backgroundImage1 from "../image/backlogin1.jpg";
import backgroundImage2 from "../image/backlogin2.jpg";
import backgroundImage3 from "../image/backlogin3.jpg";
import backgroundImage4 from "../image/backlogin4.jpg";

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Validation des données
  const validateData = () => {
    const errors = {};
    if (!phoneNumber) errors.phone = "Veuillez entrer un numéro de téléphone";
    else if (!/^\+?[0-9]{9,15}$/.test(phoneNumber))
      errors.phone = "Numéro invalide (9-15 chiffres, indicatif + optionnel)";
    return errors;
  };

  // Soumission du formulaire (connexion ou inscription guest)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    // Validation
    const validationErrors = validateData();
    if (Object.keys(validationErrors).length > 0) {
      setError(validationErrors.phone);
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;
      const guestId = `guest-${formattedPhone}`;

      // Vérifier si le numéro existe dans guestUsers
      const guestUsersRef = doc(db, "guestUsers", "group1");
      const docSnap = await getDoc(guestUsersRef);
      let existingUser = null;
      let users = [];

      if (docSnap.exists()) {
        users = docSnap.data().users || [];
        existingUser = users.find((user) => user.phone === formattedPhone);
      }

      if (existingUser) {
        // Utilisateur guest existant : Connexion rapide (formalité)
        localStorage.setItem("guestUid", guestId);
        localStorage.setItem("guestPhone", formattedPhone);

        setSuccessMessage("Connexion réussie !");
        setTimeout(() => navigate("/accueil"), 2000);
      } else {
        // Nouvel utilisateur guest : Créer un compte
        await setDoc(doc(db, "usersrestau", guestId), {
          uid: guestId,
          name: "Invité",
          phone: formattedPhone,
          isGuest: true,
          createdAt: new Date(),
        });

        const newGuestUser = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: "Invité",
          phone: formattedPhone,
          createdAt: new Date(),
        };
        if (docSnap.exists()) {
          await updateDoc(guestUsersRef, { users: arrayUnion(newGuestUser) });
        } else {
          await setDoc(guestUsersRef, { users: [newGuestUser] });
        }

        localStorage.setItem("guestUid", guestId);
        localStorage.setItem("guestPhone", formattedPhone);

        setSuccessMessage("Compte créé avec succès !");
        setTimeout(() => navigate("/accueil"), 2000);
      }
    } catch (err) {
      console.error("Error processing guest account:", err);
      setError("Erreur lors du traitement du compte.");
    } finally {
      setLoading(false);
    }
  };

  // Connexion Google
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Enregistrer dans usersrestau si nouvel utilisateur
      const userRef = doc(db, "usersrestau", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const [firstName = "", lastName = ""] = user.displayName?.split(" ") || [];
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          firstName,
          lastName,
          createdAt: new Date(),
        });
      }

      setSuccessMessage("Connexion réussie !");
      setTimeout(() => navigate("/accueil"), 2000);
    } catch (err) {
      console.error("Google sign in error:", err);
      setError("Erreur lors de la connexion Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center relative overflow-hidden p-4">
      {/* Conteneurs pour les images de fond avec animation stylée */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${backgroundImage1})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          animation: "styleFade 16s infinite",
          transformOrigin: "center",
        }}
      ></div>
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${backgroundImage2})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          animation: "styleFade 16s infinite 4s",
          transformOrigin: "center",
        }}
      ></div>
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${backgroundImage3})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          animation: "styleFade 16s infinite 8s",
          transformOrigin: "center",
        }}
      ></div>
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${backgroundImage4})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          animation: "styleFade 16s infinite 12s",
          transformOrigin: "center",
        }}
      ></div>

      {/* Overlay avec gradient circulaire inversé */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.56) 0%, rgba(0,0,0,0.8) 70%)
          `,
        }}
      ></div>

      {/* Titre et textes centrés */}
      <div className="w-full max-w-md flex flex-col items-center z-10 mt-1">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            <span className="text-red-600">Mange</span> d'Abord
          </h1>
          <p className="text-white/90 text-lg mt-1">Bienvenue sur Mange d'Abord</p>
          <p className="text-white/30 text-base mt-2">
            Vos plats préférés, livrés chez vous en un rien de temps ! Recevez le menu du jour et commandez en un clic.
          </p>
        </div>
      </div>

      {/* Texte centré au milieu */}
      <div className="w-full max-w-md flex flex-col items-center z-10 my-14">
        <p className="text-white/90 text-lg text-center">
          Pour découvrir notre <span className="text-red-600">menu du jour</span> ou commander votre repas,
        </p>
      </div>

      {/* Formulaire et boutons en bas */}
      <div className="w-full max-w-md flex flex-col z-10 mt-auto mb-1">
        <div className="space-y-1">
          {error && (
            <div className="bg-black text-white p-2 rounded-lg mb-2 text-center border border-white/20">
              <i className="fas fa-exclamation-circle mr-2 text-red-600"></i>
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-red-600 text-white p-2 rounded-lg mb-2 text-center">
              <i className="fas fa-check-circle mr-2"></i>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-1">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-1 px-4 bg-white/80 border border-white/20 rounded-lg font-medium text-black hover:bg-white transition-all duration-300 shadow-sm hover:shadow-md flex items-center justify-center"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-2" />
              Continuer avec Google
            </button>
            <p className="text-center text-sm text-white/80 my-1">OU</p>

            {/* Connexion guest */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                <i className="fas fa-user mr-2 text-red-600"></i>
                Connexion en tant qu'invité
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-red-600">+</span>
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="237 123 456 789"
                  className="w-full pl-8 pr-4 py-2 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent text-white placeholder-white/50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center ${
                loading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Traitement...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt mr-2"></i>
                  Continuer
                </>
              )}
            </button>
          </form>

          <div className="mt-1 text-center text-sm text-white/80">
            <p>
              En continuant, vous acceptez nos{" "}
              <a href="#" className="text-red-600 hover:text-red-500 font-medium">
                Conditions d'utilisation
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Styles pour l'animation stylée */}
      <style jsx global>{`
        @keyframes styleFade {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          20% {
            opacity: 1;
            transform: scale(1.05);
          }
          25% {
            opacity: 0;
            transform: scale(1.05);
          }
          95% {
            opacity: 0;
            transform: scale(1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default Login;