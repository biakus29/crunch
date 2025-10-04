import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FaTruck, FaPhone, FaLock } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DeliveryPersonLogin = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      toast.error('Veuillez entrer votre numéro de téléphone');
      return;
    }

    setLoading(true);

    try {
      // Normaliser le numéro de téléphone (enlever espaces et caractères spéciaux)
      const normalizePhone = (phoneNumber) => {
        return phoneNumber.replace(/[\s\-\(\)]/g, '');
      };

      const inputPhone = normalizePhone(phone.trim());

      // Récupérer tous les livreurs et chercher une correspondance
      const deliverersSnap = await getDocs(collection(db, 'deliverers'));
      
      let foundDeliverer = null;
      let delivererId = null;

      deliverersSnap.forEach((doc) => {
        const data = doc.data();
        const normalizedDbPhone = normalizePhone(data.phone || '');
        
        // Vérifier si les numéros correspondent (avec ou sans indicatif)
        if (normalizedDbPhone === inputPhone || 
            normalizedDbPhone.endsWith(inputPhone) || 
            inputPhone.endsWith(normalizedDbPhone.slice(-9))) {
          foundDeliverer = data;
          delivererId = doc.id;
        }
      });

      if (!foundDeliverer) {
        toast.error('Aucun compte livreur trouvé avec ce numéro');
        setLoading(false);
        return;
      }

      // Vérifier si le livreur est actif
      if (!foundDeliverer.active) {
        toast.error('Votre compte est désactivé. Contactez votre gestionnaire.');
        setLoading(false);
        return;
      }

      // Stocker les infos du livreur dans le localStorage
      localStorage.setItem('delivererPhone', foundDeliverer.phone);
      localStorage.setItem('delivererName', foundDeliverer.name);
      localStorage.setItem('delivererId', delivererId);

      toast.success(`Bienvenue ${foundDeliverer.name} !`);
      
      // Rediriger vers l'interface livreur
      setTimeout(() => {
        navigate('/delivery-person');
      }, 1000);

    } catch (error) {
      console.error('Erreur de connexion:', error);
      toast.error('Erreur lors de la connexion');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
      <ToastContainer position="top-center" autoClose={3000} />
      
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-4">
            <FaTruck className="text-4xl text-orange-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Espace Livreur</h1>
          <p className="text-gray-600">Connectez-vous pour gérer vos livraisons</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numéro de téléphone
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaPhone className="text-gray-400" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 690123456"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Entrez le numéro enregistré dans votre compte
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500'
            } transition-colors`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Connexion...
              </>
            ) : (
              <>
                <FaLock className="mr-2" />
                Se connecter
              </>
            )}
          </button>
        </form>

        {/* Informations supplémentaires */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">Vous n'avez pas de compte ?</p>
            <p className="text-orange-600 font-medium">
              Contactez votre gestionnaire de livraison
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-orange-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-orange-800 mb-2">
            📱 Comment se connecter ?
          </h3>
          <ul className="text-xs text-orange-700 space-y-1">
            <li>• Entrez votre numéro de téléphone</li>
            <li>• Cliquez sur "Se connecter"</li>
            <li>• Accédez à vos commandes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DeliveryPersonLogin;
