import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import logo from '../image/logo.png';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const googleProvider = new GoogleAuthProvider();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) navigate('/');
    });
    return () => unsubscribe();
  }, [navigate]);

  const normalizePhone = (phoneInput) => phoneInput.startsWith('+') ? phoneInput : `+237${phoneInput}`;

  const validateForm = () => {
    const errors = {};
    if (!email || !/\S+@\S+\.\S+/.test(email)) errors.email = 'Email invalide';
    if (!password || password.length < 6) errors.password = 'Le mot de passe doit avoir au moins 6 caractères';
    if (isSignUp && (!phone || !/^\+?[0-9]{9,15}$/.test(normalizePhone(phone)))) {
      errors.phone = 'Numéro invalide (9-15 chiffres)';
    }
    return errors;
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const validationErrors = validateForm();
      if (Object.keys(validationErrors).length > 0) throw new Error(Object.values(validationErrors)[0]);
      
      await signInWithEmailAndPassword(auth, email, password);
      if (phone.trim() !== '') {
        const phoneQuery = normalizePhone(phone);
        const userDocRef = doc(db, 'usersrestau', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().phone !== phoneQuery) {
          await updateDoc(userDocRef, { phone: phoneQuery });
        }
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const validationErrors = validateForm();
      if (Object.keys(validationErrors).length > 0) throw new Error(Object.values(validationErrors)[0]);
      
      const phoneQuery = normalizePhone(phone);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, 'usersrestau', userCredential.user.uid);
      await setDoc(userDocRef, {
        uid: userCredential.user.uid,
        email,
        phone: phoneQuery,
        firstName: '',
        lastName: '',
        createdAt: new Date(),
      });
      navigate('/');
    } catch (err) {
      let errorMessage = 'Erreur lors de l’inscription';
      if (err.code === 'auth/email-already-in-use') errorMessage = 'Cet email est déjà utilisé';
      else if (err.code === 'auth/invalid-email') errorMessage = 'Email invalide';
      else if (err.code === 'auth/weak-password') errorMessage = 'Mot de passe trop faible';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userDocRef = doc(db, 'usersrestau', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const [firstName = '', lastName = ''] = user.displayName?.split(' ') || [];
        const phoneQuery = phone ? normalizePhone(phone) : '';
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          phone: phoneQuery,
          firstName,
          lastName,
          createdAt: new Date(),
        });
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Erreur lors de la connexion avec Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setError(Object.values(validationErrors)[0]);
      return;
    }
    if (isSignUp) handleSignUp(e);
    else handleSignIn(e);
  };

  const InputField = ({ label, id, type, value, onChange, placeholder, required = false }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && '*'}
      </label>
      <input
        type={type}
        id={id}
        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-20">
      <header className="bg-white border-b p-3 flex items-center justify-between">
        <Link to="/" className="text-green-600 font-bold text-lg flex items-center">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <Link to="#" className="text-gray-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </Link>
      </header>

      <div className="flex-grow p-4 flex flex-col items-center justify-center">
        <img src={logo} alt="Logo" className="w-24 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-1">
          {isSignUp ? 'Créer un compte' : 'Welcome Back'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {isSignUp ? "Inscrivez-vous pour continuer." : "Sign in to continue."}
        </p>

        <form onSubmit={handleSubmit} className="w-full macro-w-md space-y-4">
          <InputField label="Email" id="emailInput" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Entrez votre email" required />
          <InputField label={`Numéro de téléphone ${isSignUp ? '*' : '(optionnel)'}`} id="phoneInput" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 698123456" required={isSignUp} />
          <InputField label="Mot de passe" id="passwordInput" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Entrez votre mot de passe" required />
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          <button
            type="submit"
            className={`w-full py-3 rounded-lg text-white font-semibold transition-colors ${loading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isSignUp ? 'Création du compte...' : 'Connexion...'}
              </span>
            ) : (
              isSignUp ? "S’inscrire" : 'Se connecter'
            )}
          </button>
        </form>

        <div className="w-full max-w-md mt-4">
          <button
            onClick={handleGoogleSignIn}
            className={`w-full py-3 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold flex items-center justify-center transition-colors ${loading ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-100'}`}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-gray-700" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connexion...
              </span>
            ) : (
              <>
                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.02.68-2.31 1.08-3.71 1.08-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isSignUp ? 'S’inscrire avec Google' : 'Se connecter avec Google'}
              </>
            )}
          </button>
        </div>

        <p className="text-gray-500 text-sm mt-4">
          {isSignUp ? "Vous avez déjà un compte ?" : "Pas de compte ?"}
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-green-600 font-medium ml-1 hover:underline">
            {isSignUp ? 'Se connecter' : "S'inscrire"}
          </button>
        </p>
      </div>

      <footer className="fixed bottom-0 w-full bg-white border-t p-3 shadow-lg text-center">
        {isSignUp ? (
          <span className="text-gray-700">En vous inscrivant, vous acceptez nos conditions d'utilisation.</span>
        ) : (
          <span className="text-gray-700">© 2025 Mange d'Abord</span>
        )}
      </footer>
    </div>
  );
};

export default Auth;