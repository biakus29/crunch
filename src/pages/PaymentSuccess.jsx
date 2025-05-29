import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/cartcontext';
import { auth, db } from '../firebase';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const searchParams = new URLSearchParams(location.search);
  const orderId = searchParams.get('order_id');
  const transactionId = searchParams.get('transaction_id');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const createOrder = async () => {
      if (!orderId || !transactionId) {
        console.warn('Paramètres de paiement manquants');
        setError('Informations de paiement manquantes.');
        navigate('/payment/failure', { state: { error: 'Informations de paiement manquantes.' } });
        setLoading(false);
        return;
      }

      try {
        // Récupérer les données temporaires
        const tempOrderData = JSON.parse(localStorage.getItem('tempOrderData'));

        if (!tempOrderData) {
          throw new Error('Données de commande non trouvées.');
        }

        // Créer la commande dans Firestore
        const orderRef = await addDoc(collection(db, 'orders'), {
          ...tempOrderData,
          status: 'confirmed', // Statut pour paiement mobile réussi
          isPaid: true, // Paiement confirmé
          paymentRef: transactionId,
          timestamp: new Date().toISOString(),
        });

        // Mettre à jour les points si non-guest
        if (!tempOrderData.isGuest && tempOrderData.pointsUsed > 0) {
          const userId = auth.currentUser?.uid || tempOrderData.userId;
          await updateDoc(doc(db, 'usersrestau', userId), {
            points: tempOrderData.points - tempOrderData.pointsUsed,
          });
        }

        // Enregistrer la transaction de points
        if (!tempOrderData.isGuest && tempOrderData.loyaltyPoints > 0) {
          await addDoc(collection(db, 'points_transactions'), {
            userId: tempOrderData.userId,
            orderId: orderRef.id,
            pointsAmount: tempOrderData.loyaltyPoints,
            status: 'completed',
            timestamp: true,
            message: `Points earned for order #${orderRef.id.slice(-6)}`,
            type: 'transaction',
          });
        }

        // Nettoyer et rediriger
        localStorage.removeItem('tempOrderData');
        clearCart();
        navigate('/complete_order', {
          state: {
            orderId: orderRef.id,
            paymentStatus: 'confirmed',
            transactionId,
            isGuest: tempOrderData.isGuest,
          },
        });
      } catch (err) {
        console.error('Erreur lors de la création de la commande :', err);
        setError(err.message || 'Erreur lors du traitement de la commande.');
        navigate('/complete', { state: { error: err.message } });
      } finally {
        setLoading(false);
      }
    };

    createOrder();
  }, [orderId, transactionId, navigate, clearCart]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">Paiement en cours...</h2>
          <p>Vous serez redirigé sous peu.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Erreur</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return null; // La redirection se fait dans useEffect
};

export default PaymentSuccess;