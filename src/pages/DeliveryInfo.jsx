import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTruck, FaUserTie, FaArrowRight, FaPhone, FaLaptop } from 'react-icons/fa';

const DeliveryInfo = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Système de Livraison
          </h1>
          <p className="text-xl text-white opacity-90">
            Choisissez votre interface
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Carte Livreur */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 hover:transform hover:scale-105 transition-all duration-300">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-4">
                <FaTruck className="text-4xl text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Livreur</h2>
              <p className="text-gray-600">
                Interface mobile pour gérer vos livraisons
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mr-3 mt-1">
                  <span className="text-orange-600 text-sm font-bold">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Voir vos commandes</p>
                  <p className="text-xs text-gray-500">Commandes assignées en temps réel</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mr-3 mt-1">
                  <span className="text-orange-600 text-sm font-bold">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Gérer les livraisons</p>
                  <p className="text-xs text-gray-500">Démarrer et terminer les livraisons</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mr-3 mt-1">
                  <span className="text-orange-600 text-sm font-bold">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Suivre vos gains</p>
                  <p className="text-xs text-gray-500">Statistiques quotidiennes</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4 mb-6">
              <div className="flex items-center text-orange-800 mb-2">
                <FaPhone className="mr-2" />
                <span className="text-sm font-semibold">Connexion par téléphone</span>
              </div>
              <p className="text-xs text-orange-700">
                Utilisez votre numéro de téléphone enregistré
              </p>
            </div>

            <button
              onClick={() => navigate('/login-livreur')}
              className="w-full bg-orange-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center"
            >
              Se connecter
              <FaArrowRight className="ml-2" />
            </button>
          </div>

          {/* Carte Gestionnaire */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 hover:transform hover:scale-105 transition-all duration-300">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                <FaUserTie className="text-4xl text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Gestionnaire</h2>
              <p className="text-gray-600">
                Interface complète de gestion des livraisons
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                  <span className="text-blue-600 text-sm font-bold">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Gérer les livreurs</p>
                  <p className="text-xs text-gray-500">Créer et gérer les comptes</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                  <span className="text-blue-600 text-sm font-bold">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Assigner les commandes</p>
                  <p className="text-xs text-gray-500">Optimiser les livraisons</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                  <span className="text-blue-600 text-sm font-bold">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Suivre en temps réel</p>
                  <p className="text-xs text-gray-500">Tracking et statistiques</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="flex items-center text-blue-800 mb-2">
                <FaLaptop className="mr-2" />
                <span className="text-sm font-semibold">Interface complète</span>
              </div>
              <p className="text-xs text-blue-700">
                Accès via le tableau de bord administrateur
              </p>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              Accéder au tableau de bord
              <FaArrowRight className="ml-2" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white text-sm opacity-75">
            Besoin d'aide ? Contactez votre administrateur
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeliveryInfo;
