import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PaymentFailed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const error = location.state?.error || 'Le paiement a échoué.';

  const handleRetry = () => {
    navigate('/cart'); // Rediriger vers le panier pour réessayer
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Échec du paiement</h2>
        <p className="text-gray-700 mb-4">{error}</p>
        <button
          onClick={handleRetry}
          className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
};

export default PaymentFailed;