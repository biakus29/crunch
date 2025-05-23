import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import backgroundImage1 from "../image/backlogin1.jpg";
import backgroundImage2 from "../image/backlogin2.jpg";
import backgroundImage3 from "../image/backlogin3.jpg";
import backgroundImage4 from "../image/backlogin4.jpg";
import logo from "../image/logo.png";

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("guestUid")) {
      navigate("/accueil");
    }
  }, [navigate]);

  const validateData = () => {
    const errors = {};
    if (!phoneNumber) errors.phone = "Veuillez entrer un numéro de téléphone";
    else if (!/^\+?[0-9]{9,15}$/.test(phoneNumber))
      errors.phone = "Numéro invalide (9-15 chiffres, indicatif + optionnel)";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    const validationErrors = validateData();
    if (Object.keys(validationErrors).length > 0) {
      setError(validationErrors.phone);
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;
      const guestId = `guest-${formattedPhone}`;
      const guestUsersRef = doc(db, "guestUsers", "group1");
      const docSnap = await getDoc(guestUsersRef);
      let existingUser = null;
      let users = [];
      if (docSnap.exists()) {
        users = docSnap.data().users || [];
        existingUser = users.find((user) => user.phone === formattedPhone);
      }
      if (existingUser) {
        localStorage.setItem("guestUid", guestId);
        localStorage.setItem("guestPhone", formattedPhone);
        setSuccessMessage("Connexion réussie !");
        setTimeout(() => navigate("/accueil"), 2000);
      } else {
        await setDoc(doc(db, "usersRestau", guestId), {
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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "usersRestau", user.uid);
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
    <div className="min-h-screen w-full flex flex-col items-center relative overflow-hidden p-4 sm:p-6 font-sans">
      {[backgroundImage1, backgroundImage2, backgroundImage3, backgroundImage4].map((bg, index) => (
        <div
          key={index}
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${bg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            animation: `styleFade 12s infinite ${index * 3}s`,
            transformOrigin: "center",
          }}
        ></div>
      ))}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.5) 0%, rgba(0,0,0,0.75) 70%)`,
        }}
      ></div>

      <div className="w-full max-w-[90vw] sm:max-w-sm md:max-w-md flex flex-col items-center z-10 mt-4 sm:mt-8">
        <div className="text-center animate-fadeIn">
          <p className="text-white/90 text-xl sm:text-base font-medium mb-2 sm:mb-3">Bienvenue sur Mange d'Abord</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-2 sm:mb-4 tracking-tight">
            <span className="text-red-600">Mange</span> d'Abord
          </h1>
          <p className="text-white/70 text-xl sm:text-sm max-w-xs mx-auto leading-relaxed line-clamp-2">
            Vos plats préférés, livrés chez vous en un rien de temps ! Commandez en un clic.
          </p>
        </div>
      </div>

      <div className="absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-full px-2 sm:px-4">
  <h2 className="text-white/90 text-base sm:text-3xl md:text-xl text-center max-w-[90vw] sm:max-w-sm md:max-w-md font-bold leading-relaxed line-clamp-3">
    Pour découvrir notre <span className="text-red-600 font-medium">menu du jour</span> ou commander votre repas,
    continuez avec l'une des options suivantes.
  </h2>
</div>

      <div className="w-full max-w-[90vw] sm:max-w-sm md:max-w-md flex flex-col z-10 mt-auto mb-4 sm:mb-8">
        <div className="space-y-3 sm:space-y-5">
          {error && (
            <div
              className="bg-black/80 text-white p-2 sm:p-3 rounded-lg mb-1 sm:mb-2 text-center border border-white/20 text-xs sm:text-sm"
              aria-live="polite"
            >
              <i className="fas fa-exclamation-circle mr-1 sm:mr-2 text-red-600"></i>
              {error}
            </div>
          )}
          {successMessage && (
            <div
              className="bg-red-600 text-white p-2 sm:p-3 rounded-lg mb-1 sm:mb-2 text-center text-xs sm:text-sm"
              aria-live="polite"
            >
              <i className="fas fa-check-circle mr-1 sm:mr-2"></i>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2 sm:py-3 px-3 sm:px-5 bg-gray-100 border border-gray-300 rounded-lg font-medium text-gray-800 hover:bg-white transition-all duration-300 flex items-center justify-center text-xs sm:text-sm"
              aria-label="Se connecter avec Google"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 sm:w-5 h-4 sm:h-5 mr-2 sm:mr-3" />
              Continuer avec Google
            </button>

            <div className="flex items-center text-xs sm:text-sm text-white/80 my-3 sm:my-4 mx-1 sm:mx-2">
              <div className="border-t border-gray-400 flex-1"></div>
              <span className="mx-2 sm:mx-3">OU</span>
              <div className="border-t border-gray-400 flex-1"></div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-white mb-1">
                <i className="fas fa-phone-alt mr-1 sm:mr-2 text-red-600"></i>
                Numéro de téléphone
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ex: +237123456789"
                  className="w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 sm:py-3 bg-black/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent text-white placeholder-white/50 text-xs sm:text-sm"
                  required
                  aria-label="Entrer votre numéro de téléphone"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 sm:py-3 px-3 sm:px-5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center text-xs sm:text-sm"
              aria-label="Continuer avec le numéro de téléphone"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1 sm:mr-2"></i>
                  Traitement...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt mr-1 sm:mr-2"></i>
                  Continuer
                </>
              )}
            </button>
          </form>

          <div className="mt-3 sm:mt-4 text-center text-xs sm:text-sm text-white/80 px-2 sm:px-4">
            <p className="line-clamp-2">
              En continuant, vous acceptez nos{" "}
              <a href="#" className="text-red-600 hover:text-red-500 font-medium">
                Conditions d'utilisation
              </a>{" "}
              et reconnaissez avoir lu notre{" "}
              <a href="#" className="text-red-600 hover:text-red-500 font-medium">
                Politique de confidentialité
              </a>
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 1s ease-out forwards;
        }
        @keyframes styleFade {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          20% {
            opacity: 1;
            transform: scale(1.03);
          }
          25% {
            opacity: 0;
            transform: scale(1.03);
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
        /* Optimisations pour la flexibilité */
        @media (max-width: 375px) {
          .min-h-screen {
            padding: 0.75rem;
          }
          .absolute.top-[20%] {
            top: 15%;
            padding: 0 0.5rem;
          }
          .text-2xl {
            font-size: 1.25rem;
          }
          .text-base {
            font-size: 0.875rem;
          }
          .max-w-sm {
            max-width: 85vw;
          }
          [style*="animation"] {
            animation-duration: 10s;
          }
          .text-xs {
            font-size: 0.75rem;
          }
          .py-2 {
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
          .px-3 {
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }
        }
        @media (min-width: 376px) and (max-width: 640px) {
          .min-h-screen {
            padding: 1rem;
          }
          .absolute.top-[20%] {
            top: 18%;
            padding: 0 1rem;
          }
          .max-w-sm {
            max-width: 90vw;
          }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .min-h-screen {
            padding: 1.5rem;
          }
          .absolute.top-[25%] {
            top: 22%;
          }
        }
        @media (min-width: 1025px) {
          .min-h-screen {
            padding: 2rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;