import React, { useState } from 'react';
import { initializeDeliverers, DELIVERERS_DATA } from '../../utils/createDeliverers';
import { FaTruck, FaCheckCircle, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';

/**
 * Composant pour initialiser les comptes livreurs
 * À utiliser une seule fois pour créer les comptes initiaux
 */
const InitializeDeliverers = ({ restaurantId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleInitialize = async () => {
    if (!restaurantId) {
      toast.error('Restaurant ID manquant');
      return;
    }

    if (!window.confirm(`Voulez-vous créer ${DELIVERERS_DATA.length} comptes livreurs pour ce restaurant ?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await initializeDeliverers(restaurantId);
      setResult(res);
      toast.success('Livreurs initialisés avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'initialisation');
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-3 rounded-full">
                <FaTruck className="text-2xl text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Initialiser les livreurs</h2>
                <p className="text-sm text-gray-600">Créer les comptes pour les livreurs existants</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Liste des livreurs à créer */}
          {!result && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">
                Livreurs à créer ({DELIVERERS_DATA.length}) :
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {DELIVERERS_DATA.map((deliverer, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg"
                  >
                    <FaTruck className="text-blue-500" />
                    <div>
                      <div className="font-medium text-gray-900">{deliverer.name}</div>
                      <div className="text-xs text-gray-500">{deliverer.vehicleType}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Résultat */}
          {result && result.success && (
            <div className="mb-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <FaCheckCircle className="text-green-600 text-xl" />
                  <h3 className="font-semibold text-green-800">Initialisation réussie !</h3>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Collection deliverers :</span>
                    <span className="font-medium text-green-700">
                      ✅ {result.deliverers.created} créés, ⏭️ {result.deliverers.skipped} ignorés
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Collection employees :</span>
                    <span className="font-medium text-green-700">
                      ✅ {result.employees.created} créés, ⏭️ {result.employees.skipped} ignorés
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Prochaines étapes :</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Mettre à jour les numéros de téléphone des livreurs</li>
                  <li>• Configurer les zones de livraison</li>
                  <li>• Ajouter les numéros de véhicules</li>
                  <li>• Créer les comptes d'authentification si nécessaire</li>
                </ul>
              </div>
            </div>
          )}

          {result && !result.success && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <FaExclamationTriangle className="text-red-600 text-xl" />
                <h3 className="font-semibold text-red-800">Erreur</h3>
              </div>
              <p className="text-sm text-red-700">{result.error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            {!result && (
              <button
                onClick={handleInitialize}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Création en cours...</span>
                  </>
                ) : (
                  <>
                    <FaTruck />
                    <span>Créer les comptes livreurs</span>
                  </>
                )}
              </button>
            )}
            
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
            >
              {result ? 'Fermer' : 'Annuler'}
            </button>
          </div>

          {/* Avertissement */}
          {!result && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <FaExclamationTriangle className="text-yellow-600 mt-0.5" />
                <div className="text-xs text-yellow-800">
                  <strong>Important :</strong> Cette action créera les comptes dans les collections 
                  <code className="bg-yellow-100 px-1 rounded">deliverers</code> et 
                  <code className="bg-yellow-100 px-1 rounded ml-1">employees</code>. 
                  Les livreurs existants seront ignorés automatiquement.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InitializeDeliverers;
